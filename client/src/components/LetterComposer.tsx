import { useState } from "react";
import { MAI_FINAL_LETTER_PAGES } from "../data/letter";

interface LetterComposerProps {
  draftLetter: string;
  onChange: (text: string) => void;
}

const PLACEHOLDER = MAI_FINAL_LETTER_PAGES.join("\n\n");

export function LetterComposer({ draftLetter, onChange }: LetterComposerProps) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="letter-composer">
      <div className="letter-composer-header">편지 쓰기</div>
      <p className="letter-composer-hint">
        누누 이야기를 듣고 편지를 쓰고 싶어졌다면, 여기서 써보세요. 3D 월드에서 이 편지를 들고
        우체국으로 갈 수 있어요.
      </p>
      <textarea
        className="letter-composer-textarea"
        placeholder={PLACEHOLDER}
        value={draftLetter}
        onChange={(e) => {
          onChange(e.target.value);
          setSaved(false);
        }}
        rows={6}
      />
      <button
        className="letter-composer-save"
        onClick={() => setSaved(true)}
        disabled={!draftLetter.trim()}
      >
        {saved ? "저장됨" : "편지 완성"}
      </button>
    </div>
  );
}
