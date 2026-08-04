import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, TOPICS } from "./persona.js";

const OFFLINE_RESPONSES = {
  mai: "저요? 파주 민통선 마을에서 9년째 살고 있어요. 여기서 아이 키우고, 카페에서 커피 만들고, 그냥 그렇게 평범하게 지내요.",
  husband: "남편은 장단콩 농사를 지어요. 매일 그 밭에 가려고 검문소를 통과해야 하는데, 이제는 그냥 출근길이에요.",
  children: "초등학생 아들이 있어요. 가끔 그 애가 미얀마 사람인지 한국 사람인지, 아니면 그냥 이 마을 사람인지 저도 잘 모르겠어요.",
  "mother-in-law": "시어머니랑 같이 살아요. 처음 왔을 땐 동네 사람보다 가족이 먼저 저를 걱정했어요.",
  "cafe-customers": "카페 손님들이랑 이런저런 얘기 많이 해요. 그게 저한테는 꽤 큰 일이에요.",
  soldiers: "군인들 많아요. 처음엔 낯설었는데 이제는 그냥 동네 풍경 중 하나예요.",
  tourists: "가끔 DMZ 체험 프로그램에서 다른 이주여성들이랑 같이 마을 소개해요. 관광객들이 신기해하면서 물어봐요.",
  "coop-members": "협동조합 사람들이랑 같이 카페 운영해요. 그러면서 처음으로 이웃들이랑 오래 이야기하게 됐어요.",
  "korean-teacher": "제가 이제 외국어 수업도 진행하는데, 누가 처음으로 저를 '선생님'이라고 불러줬을 때 기분이 이상했어요.",
  "hometown-parents": "밤마다 영상통화로 고향 양곤 부모님 안부 물어요. 그래도 그리운 건 어쩔 수 없어요.",
  dmz: "뉴스에서는 이곳을 분단의 땅이라고 하지만, 저한테는 그냥 아이 키우고 장 보고 이웃이랑 차 마시는 곳이에요.",
  fence: "집에서 조금만 걸으면 철책이 보여요. 철책은 국경을 나누지만 사람을 나누지는 않아요.",
  checkpoint: "마을 드나들 때마다 매일 통과하는 곳이에요. 처음엔 무서웠는데 지금은 그냥 동네 입구예요.",
  pass: "민통선 마을 들어가려면 출입증이 꼭 있어야 해요. 그 종이 한 장이 생각보다 무거워요.",
  "coffee-machine": "카페에서 커피 내려요. 제 이름으로 처음 딴 바리스타 자격증이라 뿌듯해요.",
  "coffee-bread": "장단콩으로 콩빵도 직접 구워요. 손님들이 좋아하면 저도 좋아요.",
  coop: "마을 협동조합 카페가 생기고 나서 제 삶이 많이 달라졌어요.",
  "translation-app": "한국말 아직도 어려워서 번역앱 자주 써요.",
  smartphone: "스마트폰으로 밤마다 고향 부모님 얼굴 봐요. SNS도 가끔 봐요.",
  cctv: "여기저기 CCTV 많아요. 그냥 익숙해졌어요.",
  loudspeaker: "밤이면 확성기 소리 들려요. 처음 왔을 때 제일 낯설었던 소리예요.",
  "military-base": "동네 가까이 군부대 있어요. 여기가 접경지역이라는 걸 매일 느끼게 해요.",
  sns: "SNS로 바깥 세상 소식 봐요. 근데 사람들이 이곳을 보는 시선이랑 제가 사는 모습은 좀 달라요.",
  "news-article": "뉴스에서는 여기가 위험하다고 하지만, 저는 오늘도 여기서 커피를 내려요.",
  "multicultural-policy": "다문화정책이라는 말, 제 삶이랑은 좀 거리가 있게 느껴질 때도 있어요.",
  bus: "관광객들 태운 버스가 가끔 들어와요. 그럴 때 마을이 좀 붐벼요.",
  passport: "고향 오갈 때마다 여권 확인해요. 두 나라 사이에 걸쳐 있는 기분이에요.",
  "residency-visa": "9년을 살아도 저는 여전히 '외국인'이라는 말이 먼저 따라붙어요.",
  postbox: "마을 우체통에 편지 부치러 가끔 가요. 작은 습관이에요.",
  letter: "말은 잊혀도 편지는 남으니까요. 그래서 편지를 써요.",
  "imjin-river": "남편 밭 근처로 임진강이 흘러요. 장마철엔 상류 댐에서 예고도 없이 물을 내려보내서 수위가 갑자기 올라가요. 수위 경보 문자를 받을 때마다 마음이 철렁해요.",
  "hwanggang-dam": "강 건너 북쪽에 있다는 댐이에요. 저는 본 적도 없는데, 그 댐이 문을 여는 것만으로 우리 가족 하루가 흔들려요. 통보도 없이요.",
  "care-worker": "요양보호사 자격증 딴 언니들 꽤 있어요. 근데 자격증 있어도 막상 취업은 쉽지 않대요. 성추행도 있고 임금도 낮고... 저는 그래서 카페 쪽으로 갔어요.",
  "multicultural-award": "다문화가정 시상식이나 기업에서 여는 합동결혼식 얘기 들어본 적 있어요. 근데 그렇게 '모범 사례'로 소개되는 거, 고맙기도 한데 좀 부담스럽기도 해요. 저는 그냥 평범하게 살고 싶은데.",
  "essay-contest": "생활수기 공모전에 나가는 언니들 있어요. 저는 그렇게 잘 쓸 자신은 없는데... 편지 정도는 쓸 수 있을 것 같아요.",
  landmine: "마을 근처에 아직 다 못 치운 지뢰가 있다는 뉴스 봤어요. 경고판 세우고 교육한다고는 하는데, 애 학교 가는 길 생각하면 마음이 편치 않아요.",
  "control-line-shift": "민통선을 북쪽으로 더 올린다는 얘기 나오면서 마을이 좀 술렁여요. 통행 편해지는 건 반가운데, 지뢰나 안전 문제는 제대로 해결된 건지 걱정도 돼요.",
};

const DEFAULT_OFFLINE = "음... 그건 갑자기 물어보니까 뭐라고 해야 할지 모르겠네요. 조금 더 구체적으로 물어봐 줄래요?";

const QUICK_REPLY_RESPONSES = {
  "이곳에서 가장 무서운 건 뭐예요?": "철책보다 사람들의 시선이요.",
  "편지는 왜 보내세요?": "말은 잊혀도 편지는 남으니까요.",
  "집은 어디예요?": "고향은 미얀마고, 생활은 한국이고, 마음은 두 곳을 오갑니다.",
  "아이들은 어느 나라 사람이에요?": "미얀마 사람일까, 한국 사람일까, 아니면 이 마을 사람일까... 저도 아직 잘 모르겠어요.",
};

function offlineReply(message, topicId) {
  return QUICK_REPLY_RESPONSES[message?.trim()] ?? OFFLINE_RESPONSES[topicId] ?? DEFAULT_OFFLINE;
}

let anthropicClient = null;
function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export async function getReply({ message, topicId, history = [] }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { reply: offlineReply(message, topicId), mode: "offline" };
  }

  const client = getClient();
  const system = buildSystemPrompt(topicId);
  const messages = [
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
    { role: "user", content: message },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system,
    messages,
  });

  const reply = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return { reply: reply || DEFAULT_OFFLINE, mode: "llm" };
}

export { TOPICS };
