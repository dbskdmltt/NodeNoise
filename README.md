# Node Noise — DMZ 이주여성 프로젝트

웹 기반 인터랙티브 설치 작품 프로토타입. DMZ 접경지역에 사는 가상의 이주여성 페르소나
**누누 아웅**을 중심으로, 개인의 삶(뚜렷한 "노드")이 제도·미디어·커뮤니티라는
"노이즈"와 얽혀 있다는 ANT(행위자-네트워크 이론, Actor-Network Theory)를 시각화한다.

- **Phase 1 — ANT 채팅 인터페이스**: 네트워크 그래프 지도를 클릭해 페르소나와 대화
- **Phase 2 — 3D 마을 미션**: three.js로 만든 마을에서 편지를 우체통에 보내는 미션

2026-07-10 기준 작업 내용을 정리한 문서. (2026-07-08 세션에서 Phase 1 시작, 이후 Phase 2 및
마을 확장까지 진행)

---

## 페르소나: 누누 아웅 (Nu Nu Aung)

- 33세, 미얀마 양곤(Yangon) 출신, 결혼이주로 한국 거주 9년차
- 경기도 파주시 진동면 민통선(민간인출입통제선) 마을 거주. 남편은 파주 특산물인 장단콩 농사
- 마을을 드나들 때마다 검문소에서 출입증 확인. 주 3일 마을 협동조합 카페에서 근무
  (커피 제조, 콩빵, 외국어 수업, 가끔 DMZ 체험 프로그램 안내)
- 가족: 남편, 초등학생 아들, 함께 사는 시어머니
- 마음속 질문: "내 아이는 미얀마 사람일까, 한국 사람일까, 아니면 이 마을 사람일까"

전체 배경 설정은 [server/persona.js](server/persona.js)에, ANT 네트워크 노드/엣지는
[client/src/data/graphData.ts](client/src/data/graphData.ts)에 있다. Human(인간 행위자)
10개, Non-human(비인간 행위자) 20개로 구성된 ANT 이론 기반 2분류 체계를 사용한다.

---

## 아키텍처

```
NodeNoise/
  package.json            루트: npm workspaces + concurrently로 client/server 동시 실행
  client/                 Vite + React + TypeScript
    src/
      App.tsx               상단 뷰 전환("💬 대화" / "🎮 3D 월드"), letterUnlocked 상태 관리
      data/
        graphData.ts         ANT 그래프 노드/엣지, 카테고리 색상
        letter.ts            누누의 "마지막 편지" 텍스트 (3D 미션 클라이맥스용)
      components/
        NetworkGraph.tsx     D3-force 기반 SVG 네트워크 그래프 (클릭 선택, 검색, 하이라이트)
        ChatPanel.tsx        페르소나 채팅 UI (메시지, 퀵리플라이 4개, 입력창)
      game/                  3D 마을 (three.js, 프레임워크 없이 직접 구현)
        Game3D.tsx             씬 마운트 + 미션 대화상자 상태 머신
        scene.ts               렌더러/카메라/클릭-이동/레이캐스팅/카메라 팔로우
        environment.ts         마을(집 10채+거리+우체통+나무) 절차적 생성
        character.ts            누누 캐릭터(저폴리 프리미티브 조합) + 걷기 애니메이션
        toon.ts                 카툰 셰이딩 그라디언트맵 + 인버티드 헐 아웃라인
        MessengerBox.tsx        레퍼런스 스타일 대화창 UI ("messenger" 말풍선)
      lib/api.ts             /api/chat fetch 래퍼
    vite.config.ts          /api 프록시 → localhost:3001, allowedHosts:true (터널 공유용)
  server/                  Node.js + Express
    index.js                 POST /api/chat 엔드포인트
    persona.js                시스템 프롬프트(BIO) + 노드별 대화 주제 힌트(TOPICS)
                               + MAI_FINAL_LETTER (3D 미션용, 현재 미사용 예비 데이터)
    llm.js                    ANTHROPIC_API_KEY 있으면 Claude 호출, 없으면 오프라인 고정 응답
    .env.example             ANTHROPIC_API_KEY= (아직 비어있음 → 오프라인 모드로 동작 중)
```

---

## Phase 1: ANT 채팅 인터페이스

- 왼쪽 패널: D3-force 네트워크 그래프. 노드 클릭 시 해당 주제로 대화 트리거,
  검색창으로 노드 찾기 가능
- 오른쪽 패널: 메신저 스타일 채팅. 퀵리플라이 4개는 누누의 실제 대사 인용
  ("이곳에서 가장 무서운 건 뭐예요?" → "철책보다 사람들의 시선이요." 등)
- 오프라인 모드(API 키 없음): 노드/질문마다 미리 써둔 고정 대사로 응답
  (`server/llm.js`의 `OFFLINE_RESPONSES`, `QUICK_REPLY_RESPONSES`)
- API 키가 생기면 `server/.env`에 `ANTHROPIC_API_KEY` 넣기만 하면
  코드 변경 없이 Claude 기반 동적 대화로 전환됨

---

## Phase 2: 3D 마을 미션

- **조작**: 클릭-투-무브 (바닥/오브젝트 클릭 → 그 지점으로 이동)
- **미션 잠금 해제 조건**: 2D 채팅에서 "편지" 노드를 클릭하거나 "편지는 왜 보내세요?"
  질문을 하면 `letterUnlocked = true` (App.tsx에서 관리, 3D 씬에 prop으로 전달)
- **미션 흐름**: 우체통 클릭 → (잠금 상태면) "누누와 먼저 이야기해봐요" 안내 →
  (해제 상태면) 확인 → 편지 내용 2페이지 → "임무 완료"
- **비주얼 스타일**: 셀셰이딩(MeshToonMaterial) + 인버티드 헐 아웃라인(검은 테두리),
  레퍼런스 이미지의 코믹풍 스타일을 참고. 외부 에셋/이미지 없이 전부 Three.js 프리미티브로 절차적 생성
- **마을 레이아웃**: 메인 거리(남북 축) 양옆에 집 10채(왼쪽 5, 오른쪽 5), 각 집은
  진입로로 거리와 연결. 누누의 집이 스폰 지점. 거리 끝에 우체통

---

## 실행 방법

```bash
npm install        # 루트에서 1회 (workspaces가 client/server 의존성 모두 설치)
npm run dev         # client(:5173)와 server(:3001) 동시 실행
```

Node.js가 없으면 `winget install OpenJS.NodeJS.LTS`로 설치.

---

## 진행 중 결정 사항 (히스토리)

| 결정 | 내용 |
|---|---|
| 페르소나 교체 | 초기 "청 씨" 페르소나 → "마이 응우옌"으로 완전 교체 (사용자 제공 상세 설정 반영) |
| 노드 분류 체계 | 기존 4분류(사람/장소/제도법/디지털미디어) → ANT 이론에 맞는 Human/Non-human 2분류로 통일 |
| 3D 조작 방식 | WASD 자유이동 대신 클릭-투-무브 선택 (내러티브 어드벤처 게임에 흔한 방식, 구현 단순) |
| 3D 공간 범위 | "미니멀(집+우체통 좁은 길)" → "더 크게" → "마을(집 10개, 길로 연결)" 순으로 단계적 확장 |
| 렌더링 성능 | 그림자(shadow map) 비활성화 — 프로토타입에는 불필요하고 소프트웨어 렌더링 환경에서 가장 비용이 큰 기능 |
| 공유 방식 | 배포 대신 cloudflared 임시 터널 선택 (계정 불필요, 즉시 가능하지만 PC/프로세스가 켜져 있어야 하고 안정성 보장 없음) |
| 배포 방식 | cloudflared 터널 → Railway 상시 배포로 전환 (GitHub 연동, push 시 자동 재배포) |
| 페르소나 재교체 | "마이 응우옌"(베트남·연천) → "누누 아웅"(미얀마·파주 민통선 마을)으로 교체. 새로 수집된 파주 지역 리서치(민통선 북상, 해마루촌 지뢰, 다문화가정 합동결혼식, 이주민 공동체 등)를 배경 설정에 반영 |

---

## 다음에 이어서 할 만한 것

- `server/.env`에 실제 `ANTHROPIC_API_KEY` 추가 → 대화가 고정 응답이 아닌 실시간 LLM 응답으로 전환
- 3D 마을 안에서 노드 클릭 없이도 자연스럽게 이야기를 발견하게 하는 장치 보강
  (예: 특정 집 앞에서 힌트 대사, NPC 요소 등)
- 우체통 클릭 판정 히트박스가 다소 작아 클릭이 잘 안 될 때가 있음 — 필요시 보이지 않는
  더 큰 클릭 영역 추가 고려
- 임시 공유가 아닌 실제 배포가 필요해지면: client는 정적 호스팅(Vercel/Netlify),
  server는 Node 호스팅(Render/Railway 등)으로 분리 배포
