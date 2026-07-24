import { useEffect, useState } from "react";
import { getLetters } from "../lib/api";
import type { LetterEntry } from "../types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export function LetterArchive() {
  const [letters, setLetters] = useState<LetterEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getLetters()
      .then(setLetters)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="archive-panel">
      <div className="archive-header">
        <h2>보내지 못한 편지함</h2>
        <p>이곳에 온 사람들이 쓴, 끝내 부쳐지지 못한 편지들입니다.</p>
      </div>

      {error && <div className="archive-empty">편지함을 불러오지 못했어요.</div>}
      {!error && letters === null && <div className="archive-empty">불러오는 중...</div>}
      {letters !== null && letters.length === 0 && (
        <div className="archive-empty">아직 보관된 편지가 없어요.</div>
      )}

      <div className="archive-list">
        {letters?.map((letter, i) => (
          <div className="archive-letter" key={letter.id}>
            <div className="archive-letter-meta">
              <span>편지 #{i + 1}</span>
              <span>{formatTime(letter.createdAt)}</span>
            </div>
            <div className="archive-letter-text">{letter.censoredText}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
