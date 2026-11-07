"""
접경지역 온라인 정보 수집기 (네이버 검색 API)
- 대상: 블로그, 뉴스, 카페글
- 사례지: 접경 시·군 8곳, 서부(강화·파주) / 중부(연천·철원·화천) / 동부(양구·인제·고성)
- 출력: border_crawl_YYYYMMDD.csv (엑셀에서 바로 열림) + 연도별 건수 요약

준비
1. collector/.env 에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 이미 있으면 그대로 사용됨
   (또는 환경변수 NAVER_ID, NAVER_SECRET 로 덮어쓸 수 있음)
2. 터미널에서:  pip install requests   →   python border-crawl.py
"""

import csv
import html
import os
import re
import time
from collections import Counter
from datetime import date
from email.utils import parsedate_to_datetime

import requests

CLIENT_ID = os.environ.get("NAVER_ID") or os.environ.get("NAVER_CLIENT_ID", "여기에_Client_ID")
CLIENT_SECRET = os.environ.get("NAVER_SECRET") or os.environ.get("NAVER_CLIENT_SECRET", "여기에_Client_Secret")

# 접경 시·군별 검색어: (구간, [검색어...]). 필요하면 자유롭게 추가·수정
KEYWORDS = {
    "강화": ("서부", ["볼음도", "볼음도 배편", "볼음도 해변 쓰레기", "볼음도 함박도",
                      "교동도", "교동도 민통선", "강화 평화전망대", "강화 해안 표착 쓰레기"]),
    "파주": ("서부", ["해마루촌", "해마루촌 체험", "해마루촌 가는 길", "대성동마을",
                      "통일촌 파주", "파주 민통선 마을", "임진강 파주"]),
    "연천": ("중부", ["연천 민통선", "임진강 연천", "한탄강 연천", "연천 태풍전망대"]),
    "철원": ("중부", ["철원 민통선 마을", "철원 양지리", "철원 이길리", "철원 DMZ 평화의길"]),
    "화천": ("중부", ["화천 민통선", "북한강 화천", "평화의댐", "화천 부유 쓰레기"]),
    "양구": ("동부", ["양구 민통선", "양구 해안면", "펀치볼 마을", "두타연"]),
    "인제": ("동부", ["인제 서화면", "인제 민통선", "인제 DMZ"]),
    "고성": ("동부", ["고성 명파리", "고성 통일전망대", "고성 민통선", "고성 해안 쓰레기"]),
}

CHANNELS = {
    "blog": "https://openapi.naver.com/v1/search/blog.json",
    "news": "https://openapi.naver.com/v1/search/news.json",
    "cafe": "https://openapi.naver.com/v1/search/cafearticle.json",
}

PER_PAGE = 100   # API 최대
MAX_START = 1000  # API가 허용하는 마지막 시작 위치


def clean(text):
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def item_date(channel, item):
    """게시일을 YYYY-MM-DD로. 카페글은 API가 날짜를 주지 않음."""
    if channel == "blog" and item.get("postdate"):
        d = item["postdate"]
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
    if channel == "news" and item.get("pubDate"):
        try:
            return parsedate_to_datetime(item["pubDate"]).strftime("%Y-%m-%d")
        except (TypeError, ValueError):
            return ""
    return ""


def search(channel, query):
    headers = {"X-Naver-Client-Id": CLIENT_ID, "X-Naver-Client-Secret": CLIENT_SECRET}
    start = 1
    while start <= MAX_START:
        r = requests.get(
            CHANNELS[channel],
            headers=headers,
            params={"query": query, "display": PER_PAGE, "start": start, "sort": "date"},
            timeout=10,
        )
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
        time.sleep(0.15)  # 호출 간격


def main():
    if "여기에" in CLIENT_ID:
        raise SystemExit("CLIENT_ID / CLIENT_SECRET 을 먼저 넣어주세요.")

    rows, seen = [], set()
    for site, (region, queries) in KEYWORDS.items():
        for q in queries:
            for ch in CHANNELS:
                n = 0
                for it in search(ch, q):
                    link = it.get("link") or it.get("originallink", "")
                    if link in seen:
                        continue
                    seen.add(link)
                    rows.append({
                        "region": region,
                        "site": site,
                        "keyword": q,
                        "channel": ch,
                        "date": item_date(ch, it),
                        "title": clean(it.get("title")),
                        "summary": clean(it.get("description")),
                        "source": clean(it.get("bloggername") or it.get("cafename") or ""),
                        "link": link,
                    })
                    n += 1
                print(f"{site} | {q} | {ch}: {n}건")

    out = f"data/border-crawl-{date.today():%Y-%m-%d}.csv"
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["site"])
        w.writeheader()
        w.writerows(rows)
    print(f"\n저장: {out} (중복 제거 후 {len(rows)}건)")

    # 정보 갱신도 요약: 연도별 게시 건수 (그림자 판정의 1차 지표)
    print("\n[시·군별 · 연도별 게시 건수] (카페글은 날짜 없음)")
    for site, (region, _) in KEYWORDS.items():
        years = Counter(r["date"][:4] for r in rows if r["site"] == site and r["date"])
        line = "  ".join(f"{y}:{years[y]}" for y in sorted(years))
        print(f"[{region}] {site}: {line}")


if __name__ == "__main__":
    main()
