const BANNED_WORDS = [
  "분단",
  "북한",
  "통일",
  "자유",
  "평화",
  "이산가족",
  "월북",
  "탈북",
  "국경",
  "휴전선",
];

export function censorText(text: string): string {
  let result = text;
  let matched = false;

  for (const word of BANNED_WORDS) {
    if (result.includes(word)) {
      matched = true;
      result = result.split(word).join("█".repeat(word.length));
    }
  }

  if (!matched) {
    const words = text.split(/(\s+)/).filter((w) => w.trim().length > 1);
    if (words.length > 0) {
      const target = words[Math.floor(Math.random() * words.length)];
      result = result.replace(target, "█".repeat(target.length));
    }
  }

  return result;
}
