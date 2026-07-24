import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

const QUICK_REPLIES = [
  "이곳에서 가장 무서운 건 뭐예요?",
  "편지는 왜 보내세요?",
  "집은 어디예요?",
  "아이들은 어느 나라 사람이에요?",
];

interface ChatPanelProps {
  personaName: string;
  personaSubtitle: string;
  avatarInitial: string;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({
  personaName,
  personaSubtitle,
  avatarInitial,
  messages,
  loading,
  onSend,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit() {
    const text = draft.trim();
    if (!text || loading) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="chat-panel">
      <header className="chat-header">
        <div className="avatar">{avatarInitial}</div>
        <div>
          <div className="persona-name">{personaName}</div>
          <div className="persona-subtitle">{personaSubtitle}</div>
        </div>
      </header>

      <div className="chat-messages" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`message-row ${m.role}`}>
            {m.role === "assistant" && <div className="avatar small">{avatarInitial}</div>}
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="message-row assistant">
            <div className="avatar small">{avatarInitial}</div>
            <div className="bubble bubble-loading">...</div>
          </div>
        )}
      </div>

      <div className="chat-hint">← 지도의 노드를 클릭하면 해당 주제로 대화해요</div>

      <div className="quick-replies">
        {QUICK_REPLIES.map((q) => (
          <button key={q} className="chip" onClick={() => onSend(q)} disabled={loading}>
            {q}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="메시지를 입력하세요..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className="send-button" onClick={submit} disabled={loading}>
          전송
        </button>
      </div>
    </div>
  );
}
