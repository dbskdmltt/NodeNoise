# DMZ 이주여성 리서치 수집기

마이 응우옌 페르소나의 대사·설정을 실제 자료에 기반해 다듬기 위한 리서치 자료 수집 스크립트.
네이버 뉴스 → 공식 RSS → 네이버 데이터랩 순으로 자료를 모아 `data/`에 로컬 아카이브로 쌓고,
노션 키가 있으면 노션 데이터베이스에도 같은 내용을 기록한다.

AI 요약/트렌드 점수화는 하지 않는다 — 원문 그대로의 리서치 자료를 모으는 게 목적이라, 판단은
사람이 원문 링크를 열어서 직접 한다.

## 1. 준비물

| 항목 | 용도 | 필수 여부 |
|---|---|---|
| 네이버 개발자센터 앱 (Client ID/Secret) | 뉴스 검색 API, 데이터랩 API | 사실상 필수 (없으면 뉴스/데이터랩 단계 스킵) |
| 노션 Integration + 데이터베이스 | 결과를 노션에도 기록 | 선택 (없으면 로컬 저장만) |
| 공식 RSS 주소 | `sources.json`에 직접 등록 | 선택 |

네이버 개발자센터(developers.naver.com)에서 애플리케이션을 등록하고 "검색" API와
"데이터랩(검색어트렌드)" API 사용을 신청하면 같은 Client ID/Secret으로 둘 다 호출할 수 있다.

## 2. 설정

```bash
cd collector
cp .env.example .env
```

`.env`를 열어 값 채우기:

```
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
NOTION_TOKEN=...      # 선택
NOTION_DB_ID=...      # 선택
```

키워드는 `keywords.json`에서 카테고리별로 관리한다 (우선순위: `dmz_region` →
`migrant_voice` → `migration_policy`). 코드를 건드리지 않고 키워드만 추가/삭제하면 된다.

RSS를 쓰려면 `sources.json`의 `feeds` 배열에 직접 확인한 공식 주소만 추가한다:

```json
{
  "feeds": [
    { "name": "○○기관 보도자료", "url": "https://example.go.kr/rss/press.xml", "category": "migration_policy" }
  ]
}
```

⚠️ 검색으로 나온 비공식 RSS 생성 주소나 미러 사이트는 넣지 말 것 — 기관 공식 사이트에서
"RSS" 링크를 직접 찾아 확인한 주소만 사용한다. `feeds`가 비어 있으면 RSS 단계는 자동으로
건너뛴다.

## 3. 노션 데이터베이스 (선택)

새 데이터베이스를 만들고 아래 속성을 정확히 이 이름으로 추가한다:

| 속성명 | 유형 |
|---|---|
| 제목 | 제목 |
| 출처 | 선택 (NaverNews / RSS / NaverDatalab) |
| 카테고리 | 선택 |
| 키워드 | 다중 선택 |
| 발행일 | 날짜 |
| 수집일 | 날짜 |
| 링크 | URL |
| 요약 | 텍스트 |
| 상태 | 상태 |

그 다음 Notion에서 Integration을 만들어 토큰을 `.env`의 `NOTION_TOKEN`에 넣고, 만든
데이터베이스 페이지의 "연결" 메뉴에서 그 Integration을 추가해야 한다 (이 연결을 빼먹으면
토큰은 유효한데도 API가 데이터베이스를 찾지 못한다). 데이터베이스 URL에서 32자리 ID를 복사해
`NOTION_DB_ID`에 넣는다.

## 4. 실행

루트에서 의존성을 한 번 설치한 뒤:

```bash
npm install
npm run collect --workspace collector
```

실행할 때마다:
- 카테고리 → 키워드 순으로 네이버 뉴스 검색
- `sources.json`에 등록된 RSS 피드 읽기
- 카테고리별 네이버 데이터랩 상대 검색 관심도(최근 3일 vs 이전 3일) 계산
- 이미 `data/archive.jsonl`에 있는 URL은 건너뛰고 신규 항목만 저장
- `data/archive.jsonl`(누적)과 `data/YYYY-MM-DD.json`(그날 수집분)에 기록
- 노션 키가 있으면 신규 항목만 노션에도 페이지로 생성

한 소스가 실패해도(API 키 오류, 네트워크 문제 등) 나머지 소스는 계속 실행된다. 429 응답을
받으면 자동으로 대기 후 최대 3회 재시도한다.

## 5. 다음 단계 — 자동 스케줄링 (아직 미구현)

지금은 수동 실행만 지원한다. NodeNoise가 GitHub 저장소로 올라가면, 아래와 같은
`.github/workflows/daily-collect.yml`을 추가해 매일 자동 실행할 수 있다 (Secrets에
`NAVER_CLIENT_ID` 등을 등록하고, `collector/data/`에 생긴 변경사항을 커밋하는 스텝을
추가하면 아카이브가 저장소에 계속 쌓인다):

```yaml
name: Daily Trend Collector
on:
  schedule:
    - cron: "0 22 * * *" # UTC 22:00 = 한국시간 오전 7시 전후
  workflow_dispatch:
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run collect --workspace collector
        env:
          NAVER_CLIENT_ID: ${{ secrets.NAVER_CLIENT_ID }}
          NAVER_CLIENT_SECRET: ${{ secrets.NAVER_CLIENT_SECRET }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DB_ID: ${{ secrets.NOTION_DB_ID }}
```
