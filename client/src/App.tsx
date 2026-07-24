import { useEffect, useMemo, useState } from "react";
import { NetworkGraph } from "./components/NetworkGraph";
import { ChatPanel } from "./components/ChatPanel";
import { LetterComposer } from "./components/LetterComposer";
import { LetterArchive } from "./components/LetterArchive";
import { Game3D } from "./game/Game3D";
import { CATEGORY_COLORS, CATEGORY_LABELS, EDGES, NODES } from "./data/graphData";
import { sendChat, getLetters } from "./lib/api";
import type { ChatMessage, GraphEdge, GraphNode, LetterEntry, NodeCategory } from "./types";

const LETTER_QUESTION = "편지는 왜 보내세요?";

const INTRO_MESSAGE: ChatMessage = {
  id: "intro",
  role: "assistant",
  text: "안녕하세요. 저는 마이예요. 연천 백학면에서 11년째 살고 있어요. 여기서 조금만 걸으면 철책이 보여요. 처음엔 다 낯설었는데 이제는 그냥 제 동네예요.",
};

function newId() {
  return Math.random().toString(36).slice(2);
}

type View = "chat" | "game" | "archive";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO_MESSAGE]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("chat");
  const [letterUnlocked, setLetterUnlocked] = useState(false);
  const [draftLetter, setDraftLetter] = useState("");
  const [letters, setLetters] = useState<LetterEntry[]>([]);

  useEffect(() => {
    getLetters()
      .then(setLetters)
      .catch((err) => console.error("failed to load letters", err));
  }, []);

  const allNodes = useMemo<GraphNode[]>(() => {
    const dynamic: GraphNode[] = letters.map((letter, i) => ({
      id: `letter-${letter.id}`,
      label: `편지\n#${i + 1}`,
      category: "nonhuman",
      radius: 10,
    }));
    return [...NODES, ...dynamic];
  }, [letters]);

  const allEdges = useMemo<GraphEdge[]>(() => {
    const dynamic: GraphEdge[] = letters.map((letter) => ({
      source: "unsent-archive",
      target: `letter-${letter.id}`,
    }));
    return [...EDGES, ...dynamic];
  }, [letters]);

  const searchMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return allNodes.filter((n) => n.label.replace("\n", "").toLowerCase().includes(term));
  }, [search, allNodes]);

  async function requestReply(message: string, topicId: string | null, historyForRequest: ChatMessage[]) {
    setLoading(true);
    try {
      const { reply } = await sendChat({ message, topicId: topicId ?? undefined, history: historyForRequest });
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", text: "(연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.)" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectNode(id: string) {
    setSelectedId(id);

    if (id.startsWith("letter-")) {
      const letterId = id.slice("letter-".length);
      const letter = letters.find((l) => l.id === letterId);
      if (letter) {
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: letter.censoredText }]);
      }
      return;
    }

    if (id === "letter") setLetterUnlocked(true);
    const node = NODES.find((n) => n.id === id);
    const label = node?.label.replace("\n", " ") ?? id;
    requestReply(`[맵에서 '${label}' 주제를 선택함]`, id, messages);
  }

  function handleSend(text: string) {
    if (text.trim() === LETTER_QUESTION) setLetterUnlocked(true);
    const userMessage: ChatMessage = { id: newId(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    requestReply(text, selectedId, [...messages, userMessage]);
  }

  function handleSearchSelect(id: string) {
    setSearch("");
    handleSelectNode(id);
  }

  function handleLetterArchived(entry: LetterEntry) {
    setLetters((prev) => [...prev, entry]);
  }

  return (
    <div className="app-shell">
      <div className="view-toggle">
        <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")}>
          💬 대화
        </button>
        <button className={view === "game" ? "active" : ""} onClick={() => setView("game")}>
          🎮 3D 월드
        </button>
        <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}>
          📮 편지함
        </button>
      </div>

      {view === "chat" && (
        <div className="app">
          <div className="graph-panel">
            <NetworkGraph nodes={allNodes} edges={allEdges} selectedId={selectedId} onSelect={handleSelectNode} />
            <ul className="legend">
              {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map((cat) => (
                <li key={cat}>
                  <span className="legend-dot" style={{ background: CATEGORY_COLORS[cat] }} />
                  {CATEGORY_LABELS[cat]}
                </li>
              ))}
            </ul>
          </div>

          <div className="right-panel">
            <div className="search-row">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  placeholder="노드 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchMatches[0]) handleSearchSelect(searchMatches[0].id);
                  }}
                />
                {searchMatches.length > 0 && (
                  <ul className="search-results">
                    {searchMatches.map((n) => (
                      <li key={n.id} onClick={() => handleSearchSelect(n.id)}>
                        {n.label.replace("\n", " ")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <ChatPanel
              personaName="마이 응우옌 (35세)"
              personaSubtitle="연천 백학면 거주 · 한국 거주 11년차"
              avatarInitial="마"
              messages={messages}
              loading={loading}
              onSend={handleSend}
            />

            {letterUnlocked && <LetterComposer draftLetter={draftLetter} onChange={setDraftLetter} />}
          </div>
        </div>
      )}

      {view === "game" && (
        <Game3D
          letterUnlocked={letterUnlocked}
          draftLetter={draftLetter}
          onGoToChat={() => setView("chat")}
          onGoToArchive={() => setView("archive")}
          onLetterArchived={handleLetterArchived}
        />
      )}

      {view === "archive" && <LetterArchive />}
    </div>
  );
}
