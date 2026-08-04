import type { GraphNode, GraphEdge, NodeCategory } from "../types";

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  human: "#d64545",
  nonhuman: "#3d6fb4",
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  human: "Human (인간 행위자)",
  nonhuman: "Non-human (비인간 행위자)",
};

export const NODES: GraphNode[] = [
  // human
  { id: "mai", label: "누누\n아웅", category: "human", radius: 28 },
  { id: "husband", label: "남편", category: "human", radius: 16 },
  { id: "children", label: "아이들", category: "human", radius: 16 },
  { id: "mother-in-law", label: "시어머니", category: "human", radius: 14 },
  { id: "cafe-customers", label: "카페\n손님", category: "human", radius: 14 },
  { id: "soldiers", label: "군인", category: "human", radius: 14 },
  { id: "tourists", label: "관광객", category: "human", radius: 14 },
  { id: "coop-members", label: "협동\n조합원", category: "human", radius: 14 },
  { id: "korean-teacher", label: "한국어\n교사", category: "human", radius: 14 },
  { id: "hometown-parents", label: "고향\n부모", category: "human", radius: 14 },

  // non-human
  { id: "dmz", label: "DMZ", category: "nonhuman", radius: 22 },
  { id: "fence", label: "철책", category: "nonhuman", radius: 18 },
  { id: "checkpoint", label: "검문소", category: "nonhuman", radius: 18 },
  { id: "pass", label: "출입증", category: "nonhuman", radius: 12 },
  { id: "coffee-machine", label: "커피\n머신", category: "nonhuman", radius: 12 },
  { id: "coffee-bread", label: "커피콩\n빵", category: "nonhuman", radius: 12 },
  { id: "coop", label: "협동\n조합", category: "nonhuman", radius: 18 },
  { id: "translation-app", label: "번역\n앱", category: "nonhuman", radius: 12 },
  { id: "smartphone", label: "스마트\n폰", category: "nonhuman", radius: 14 },
  { id: "cctv", label: "CCTV", category: "nonhuman", radius: 12 },
  { id: "loudspeaker", label: "군 방송", category: "nonhuman", radius: 12 },
  { id: "military-base", label: "군부대", category: "nonhuman", radius: 14 },
  { id: "sns", label: "SNS", category: "nonhuman", radius: 14 },
  { id: "news-article", label: "뉴스\n기사", category: "nonhuman", radius: 14 },
  { id: "multicultural-policy", label: "다문화\n정책", category: "nonhuman", radius: 14 },
  { id: "bus", label: "버스", category: "nonhuman", radius: 12 },
  { id: "passport", label: "여권", category: "nonhuman", radius: 12 },
  { id: "residency-visa", label: "체류\n비자", category: "nonhuman", radius: 16 },
  { id: "postbox", label: "우체통", category: "nonhuman", radius: 12 },
  { id: "letter", label: "편지", category: "nonhuman", radius: 16 },
  { id: "unsent-archive", label: "보내지\n못한\n편지함", category: "nonhuman", radius: 20 },
  { id: "north-village", label: "북쪽\n마을", category: "nonhuman", radius: 16 },
  { id: "imjin-river", label: "임진강", category: "nonhuman", radius: 16 },
  { id: "hwanggang-dam", label: "황강댐", category: "nonhuman", radius: 14 },
  { id: "care-worker", label: "요양\n보호사", category: "nonhuman", radius: 14 },
  { id: "multicultural-award", label: "다문화\n시상식", category: "nonhuman", radius: 14 },
  { id: "essay-contest", label: "생활수기\n공모전", category: "nonhuman", radius: 14 },
  { id: "landmine", label: "미확인\n지뢰", category: "nonhuman", radius: 14 },
  { id: "control-line-shift", label: "민통선\n북상", category: "nonhuman", radius: 14 },
];

export const EDGES: GraphEdge[] = [
  // family
  { source: "mai", target: "husband" },
  { source: "mai", target: "children" },
  { source: "mai", target: "mother-in-law" },
  { source: "mai", target: "hometown-parents" },
  { source: "husband", target: "mother-in-law" },
  { source: "children", target: "mother-in-law" },

  // border / military
  { source: "mai", target: "dmz", highlighted: true },
  { source: "dmz", target: "fence" },
  { source: "dmz", target: "checkpoint" },
  { source: "dmz", target: "military-base" },
  { source: "dmz", target: "cctv" },
  { source: "dmz", target: "loudspeaker" },
  { source: "husband", target: "fence", highlighted: true },
  { source: "husband", target: "checkpoint" },
  { source: "checkpoint", target: "pass" },
  { source: "checkpoint", target: "soldiers" },
  { source: "checkpoint", target: "military-base" },

  // control line (grounded in real reporting on Haemaru-chon landmines and the control-line relocation)
  { source: "fence", target: "landmine", highlighted: true },
  { source: "children", target: "landmine" },
  { source: "checkpoint", target: "control-line-shift" },
  { source: "dmz", target: "control-line-shift" },

  // river / dam (grounded in real Imjin River flood-alert reporting)
  { source: "husband", target: "imjin-river", highlighted: true },
  { source: "dmz", target: "imjin-river" },
  { source: "imjin-river", target: "hwanggang-dam", highlighted: true },
  { source: "hwanggang-dam", target: "north-village" },

  // cafe / cooperative
  { source: "mai", target: "coop" },
  { source: "coop", target: "coffee-machine" },
  { source: "coop", target: "coffee-bread" },
  { source: "coop", target: "cafe-customers" },
  { source: "coop", target: "coop-members" },
  { source: "coop", target: "korean-teacher" },
  { source: "mai", target: "tourists" },
  { source: "tourists", target: "bus" },
  { source: "coop", target: "bus" },

  // labor / recognition (grounded in real reporting on migrant-women care work and awards)
  { source: "coop-members", target: "care-worker" },
  { source: "residency-visa", target: "care-worker" },
  { source: "multicultural-policy", target: "multicultural-award" },
  { source: "coop", target: "multicultural-award" },
  { source: "letter", target: "essay-contest", highlighted: true },
  { source: "coop-members", target: "essay-contest" },

  // digital / media
  { source: "mai", target: "smartphone" },
  { source: "smartphone", target: "translation-app" },
  { source: "smartphone", target: "sns" },
  { source: "smartphone", target: "hometown-parents" },
  { source: "sns", target: "news-article" },
  { source: "news-article", target: "multicultural-policy" },

  // legal / documents
  { source: "mai", target: "residency-visa" },
  { source: "residency-visa", target: "passport" },
  { source: "residency-visa", target: "multicultural-policy" },
  { source: "passport", target: "hometown-parents" },

  // letter (3D letter-mission thread)
  { source: "mai", target: "letter" },
  { source: "letter", target: "postbox" },
  { source: "postbox", target: "hometown-parents" },
  { source: "postbox", target: "unsent-archive" },
  { source: "postbox", target: "north-village", highlighted: true },
  { source: "unsent-archive", target: "north-village" },
];
