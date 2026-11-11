"""
접경 해안 기록 수집기 v2 (네이버 검색 API)
- core 모드: 현장 기록 거점 3곳 + 비교 섬(옹진 덕적도)의 해안·표착물 관련 글
- background 모드: 민통선이 지나는 9개 시·군 (2027 민통선 조정 전후 비교용 배경 자료)
- 출력: data/border-crawl-v2-<모드>-YYYY-MM-DD.csv  (엑셀에서 바로 열림)

사용법
  cd collector
  pip install requests
  python border-crawl-v2.py core
  python border-crawl-v2.py background
  (collector/.env 에 NAVER_CLIENT_ID/SECRET 이 있으면 그대로 쓰고, 환경변수
   NAVER_ID / NAVER_SECRET 으로 덮어쓸 수 있음)

주의
- API는 채널마다 최신순 최대 1,000건만 준다. 건수·연도 추이는 지표로 쓰지 말고,
  'mention'(장소를 실제로 언급했는지)과 내용 분류로 분석한다.
- 'mention' 열은 제목·요약에 그 장소의 이름이 실제로 들어 있는지 표시한다.
  분석에는 mention=1인 행만 쓴다.
"""

import csv
import html
import os
import re
import sys
import time
from collections import Counter
from datetime import date
from email.utils import parsedate_to_datetime

import requests

CLIENT_ID = os.environ.get("NAVER_ID") or os.environ.get("NAVER_CLIENT_ID", "여기에_Client_ID")
CLIENT_SECRET = os.environ.get("NAVER_SECRET") or os.environ.get("NAVER_CLIENT_SECRET", "여기에_Client_Secret")

# ── core: 거점별 (구분, 검색어, 언급 판정 정규식) ─────────────────────────
# 검색어는 '장소 + 해안·쓰레기 주제'로 짠다. 장소 이름만 넣으면 여행·맛집 글이 대부분을 차지한다.
# 언급 판정 정규식은 검색 결과에 장소와 무관한 글이 섞이는 것을 거르는 용도다.
CORE = {
    "볼음도": ("서부 거점", [
        "볼음도", "볼음도 해안", "볼음도 쓰레기", "볼음도 해양쓰레기", "볼음도 부표",
        "볼음도 중국 쓰레기", "볼음도 정화활동", "볼음도 지뢰", "볼음도 영뜰해변", "볼음도 조개골",
    ], r"볼음"),
    "중부 하천": ("중부 거점", [
        # 거점 하천이 확정되면 나머지 두 하천 줄을 지운다
        "임진강 쓰레기", "임진강 부유물", "임진강 북한 쓰레기", "임진강 지뢰",
        "한탄강 쓰레기", "한탄강 부유물",
        "북한강 쓰레기 화천", "북한강 부유물", "평화의댐 부유물",
    ], r"임진강|한탄강|북한강|평화의\s?댐"),
    "고성 해안": ("동부 거점", [
        "강원 고성 해안 쓰레기", "고성 해양쓰레기 강원", "고성 명파해변 쓰레기",
        "고성 대진 해안 쓰레기", "고성 거진 해양쓰레기", "고성 해안 부표", "고성 해변 지뢰",
    ], r"(강원|강원도)\s?고성|고성군|명파|대진|거진|통일전망대"),
    "옹진 덕적도": ("비교 섬", [
        "덕적도", "덕적도 해안", "덕적도 쓰레기", "덕적도 해양쓰레기", "덕적도 부표",
        "덕적도 중국 쓰레기", "덕적도 정화활동", "덕적도 해변",
    ], r"덕적"),
}

# ── background: 9개 시·군 (기존 v1 키워드 + 김포) ─────────────────────────
BACKGROUND = {
    "강화": ("서부", ["볼음도", "교동도", "교동도 민통선", "강화 평화전망대", "강화 해안 표착 쓰레기"], r"강화|볼음|교동"),
    "김포": ("서부", ["김포 민통선", "애기봉", "김포 한강하구", "김포 접경지역", "한강하구 중립수역"], r"김포|애기봉|중립수역"),
    "파주": ("서부", ["해마루촌", "대성동마을", "통일촌 파주", "파주 민통선 마을", "임진강 파주"], r"파주|해마루|대성동|통일촌"),
    "연천": ("중부", ["연천 민통선", "임진강 연천", "한탄강 연천", "연천 태풍전망대"], r"연천"),
    "철원": ("중부", ["철원 민통선 마을", "철원 양지리", "철원 이길리", "철원 DMZ 평화의길"], r"철원"),
    "화천": ("중부", ["화천 민통선", "북한강 화천", "평화의댐", "화천 부유 쓰레기"], r"화천|평화의\s?댐"),
    "양구": ("동부", ["양구 민통선", "양구 해안면", "펀치볼 마을", "두타연"], r"양구|펀치볼|두타연"),
    "인제": ("동부", ["인제 서화면", "인제 민통선", "인제 DMZ"], r"인제|서화"),
    "고성": ("동부", ["고성 명파리", "고성 통일전망대", "강원 고성 민통선", "강원 고성 해안 쓰레기"], r"(강원|강원도)\s?고성|고성군|명파|통일전망대"),
}

# 경남 고성 등 동명 지역을 걸러내는 제외어 (제목·요약에 있으면 mention=0)
EXCLUDE = re.compile(r"경남\s?고성|고성군청\s?경남|통영|공룡엑스포|규제\s?강화|강화\s?(유리|필름|마루)")

CHANNELS = {
    "blog": "https://openapi.naver.com/v1/search/blog.json",
    "news": "https://openapi.naver.com/v1/search/news.json",
    "cafe": "https://openapi.naver.com/v1/search/cafearticle.json",
}
PER_PAGE, MAX_START = 100, 1000


def clean(text):
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def item_date(channel, item):
    if channel == "blog" and item.get("postdate"):
        d = item["postdate"]
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
    if channel == "news" and item.get("pubDate"):
        try:
            return parsedate_to_datetime(item["pubDate"]).strftime("%Y-%m-%d")
        except (TypeError, ValueError):
            return ""
    return ""  # 카페글은 API가 날짜를 주지 않음


def search(channel, query):
    headers = {"X-Naver-Client-Id": CLIENT_ID, "X-Naver-Client-Secret": CLIENT_SECRET}
    start = 1
    while start <= MAX_START:
        r = requests.get(CHANNELS[channel], headers=headers, timeout=10,
                         params={"query": query, "display": PER_PAGE, "start": start, "sort": "date"})
        if r.status_code != 200:
            print(f"  ! {channel} '{query}' start={start}: {r.status_code} {r.text[:120]}")
            return
        items = r.json().get("items", [])
        if not items:
            return
        yield from items
        if len(items) < PER_PAGE:
            return
        start += PER_PAGE
        time.sleep(0.15)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "core"
    if mode not in ("core", "background"):
        raise SystemExit("사용법: python border-crawl-v2.py core | background")
    if "여기에" in CLIENT_ID:
        raise SystemExit("NAVER_ID / NAVER_SECRET 을 먼저 설정해주세요.")
    targets = CORE if mode == "core" else BACKGROUND

    rows, seen = [], set()
    for site, (group, queries, must) in targets.items():
        must_re = re.compile(must)
        for q in queries:
            for ch in CHANNELS:
                n = 0
                for it in search(ch, q):
                    link = it.get("link") or it.get("originallink", "")
                    if (site, link) in seen:
                        continue
                    seen.add((site, link))
                    title, summary = clean(it.get("title")), clean(it.get("description"))
                    text = f"{title} {summary}"
                    mention = int(bool(must_re.search(text)) and not EXCLUDE.search(text))
                    rows.append({
                        "group": group, "site": site, "keyword": q, "channel": ch,
                        "date": item_date(ch, it), "mention": mention,
                        "title": title, "summary": summary,
                        "source": clean(it.get("bloggername") or it.get("cafename") or ""),
                        "link": link,
                    })
                    n += 1
                print(f"{site} | {q} | {ch}: {n}건")

    out = f"data/border-crawl-v2-{mode}-{date.today():%Y-%m-%d}.csv"
    fields = ["group", "site", "keyword", "channel", "date", "mention", "title", "summary", "source", "link"]
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"\n저장: {out} (총 {len(rows)}건)")

    print("\n[거점별 수집 건수와 실제 언급 비율]")
    for site, (group, _, _) in targets.items():
        sub = [r for r in rows if r["site"] == site]
        m = sum(r["mention"] for r in sub)
        ch = Counter(r["channel"] for r in sub if r["mention"])
        pct = 100 * m / len(sub) if sub else 0
        print(f"[{group}] {site}: 수집 {len(sub)} / 언급 {m} ({pct:.0f}%)  {dict(ch)}")


if __name__ == "__main__":
    main()
