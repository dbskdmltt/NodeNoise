import { useEffect, useRef, useState } from "react";
import { buildScene, type SceneHandle } from "./scene";
import { MessengerBox } from "./MessengerBox";
import { censorText } from "./censorship";
import { submitLetter } from "../lib/api";
import type { LetterEntry } from "../types";

type Stage =
  | "idle"
  | "intro-greeting"
  | "intro-question"
  | "npc-hint"
  | "locked"
  | "no-draft"
  | "checkpoint-1"
  | "checkpoint-2"
  | "confirm"
  | "address-1"
  | "address-2"
  | "censorship"
  | "failed"
  | "archived";

interface Game3DProps {
  letterUnlocked: boolean;
  draftLetter: string;
  onGoToChat: () => void;
  onGoToArchive: () => void;
  onLetterArchived: (entry: LetterEntry) => void;
}

export function Game3D({ letterUnlocked, draftLetter, onGoToChat, onGoToArchive, onLetterArchived }: Game3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [censoredText, setCensoredText] = useState("");
  const [alreadyArchived, setAlreadyArchived] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);

  const stateRef = useRef({ letterUnlocked, draftLetter, alreadyArchived });
  stateRef.current = { letterUnlocked, draftLetter, alreadyArchived };

  const handlePostboxReachedRef = useRef(() => {
    const { letterUnlocked: unlocked, draftLetter: draft, alreadyArchived: done } = stateRef.current;
    if (!unlocked) {
      setStage("locked");
    } else if (!draft.trim()) {
      setStage("no-draft");
    } else if (done) {
      setCensoredText(censorText(draft));
      setStage("censorship");
    } else {
      setStage("confirm");
    }
  });

  const handleCheckpointReachedRef = useRef(() => {
    setStage("checkpoint-1");
  });

  const handleIntroCompleteRef = useRef(() => {
    setStage("intro-greeting");
  });

  const handleNpcHintReachedRef = useRef(() => {
    setStage("npc-hint");
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handle = buildScene(container, {
      onPostboxReached: () => handlePostboxReachedRef.current(),
      onCheckpointReached: () => handleCheckpointReachedRef.current(),
      onIntroComplete: () => handleIntroCompleteRef.current(),
      onNpcHintReached: () => handleNpcHintReachedRef.current(),
    });
    sceneHandleRef.current = handle;
    return () => {
      sceneHandleRef.current = null;
      handle.dispose();
    };
  }, []);

  async function archiveLetter(finalCensoredText: string) {
    setAlreadyArchived(true);
    try {
      const entry = await submitLetter(draftLetter, finalCensoredText);
      onLetterArchived(entry);
    } catch (err) {
      console.error("failed to archive letter", err);
    }
  }

  return (
    <div className="game-panel">
      <div className="game-canvas" ref={containerRef} />

      <button
        className="home-button"
        title="마을 중심으로 돌아가기"
        onClick={() => sceneHandleRef.current?.goHome()}
      >
        🏠
      </button>

      <button
        className="music-toggle-button"
        title={musicMuted ? "배경음 켜기" : "배경음 끄기"}
        onClick={() => {
          const next = !musicMuted;
          setMusicMuted(next);
          sceneHandleRef.current?.setMusicMuted(next);
        }}
      >
        {musicMuted ? "🔇" : "🔊"}
      </button>

      {stage === "intro-greeting" && (
        <MessengerBox
          speaker="누누"
          text={"안녕! 반가워. 너랑 챗봇으로 대화하던 누누야.\n같이 편지를 보내보자!"}
          primaryAction={{ label: "좋아!", onClick: () => setStage("intro-question") }}
        />
      )}

      {stage === "intro-question" && (
        <MessengerBox
          speaker="누누"
          text="편지를 보내려면 어떻게 하지?"
          primaryAction={{
            label: "네트워크맵을 살펴보자",
            onClick: () => {
              setStage("idle");
              onGoToChat();
            },
          }}
          secondaryAction={{
            label: "저기 친구에게 물어보자",
            onClick: () => {
              setStage("idle");
              sceneHandleRef.current?.awaitNpcHint();
            },
          }}
        />
      )}

      {stage === "npc-hint" && (
        <MessengerBox
          speaker="마을 주민"
          text={"음... 편지를 보내려면 검문소를 지나야 해.\n저 안쪽으로 가서 검문소를 찾아가봐!"}
          primaryAction={{ label: "알겠어!", onClick: () => setStage("idle") }}
        />
      )}

      {stage === "locked" && (
        <MessengerBox
          speaker="누누"
          text={"아직 이유를 잘 모르겠어요...\n누누와 먼저 이야기해봐요."}
          primaryAction={{
            label: "대화하러 가기",
            onClick: () => {
              setStage("idle");
              onGoToChat();
            },
          }}
        />
      )}

      {stage === "no-draft" && (
        <MessengerBox
          speaker="누누"
          text={"아직 편지를 쓰지 않았어요.\n대화창 아래에서 편지를 먼저 써보세요."}
          primaryAction={{
            label: "대화하러 가기",
            onClick: () => {
              setStage("idle");
              onGoToChat();
            },
          }}
        />
      )}

      {stage === "checkpoint-1" && (
        <MessengerBox
          speaker="검문소"
          text="잠깐만요. 신분증 좀 보여주시겠어요?"
          primaryAction={{ label: "신분증 제시", onClick: () => setStage("checkpoint-2") }}
        />
      )}

      {stage === "checkpoint-2" && (
        <MessengerBox
          speaker="검문소"
          text="...확인됐습니다. 통과하세요."
          primaryAction={{
            label: "확인",
            onClick: () => {
              setStage("idle");
              sceneHandleRef.current?.resumeAfterCheckpoint();
            },
          }}
        />
      )}

      {stage === "confirm" && (
        <MessengerBox
          speaker="우체국 직원"
          text="이 편지를 부치시겠어요?"
          primaryAction={{ label: "네", onClick: () => setStage("address-1") }}
          secondaryAction={{ label: "아니요", onClick: () => setStage("idle") }}
        />
      )}

      {stage === "address-1" && (
        <MessengerBox
          speaker="우체국 직원"
          text="수신지가 어디신가요?"
          primaryAction={{ label: "북쪽 마을이요", onClick: () => setStage("address-2") }}
        />
      )}

      {stage === "address-2" && (
        <MessengerBox
          speaker="우체국 직원"
          text={"...죄송합니다.\n그 주소는 시스템에 등록되어 있지 않습니다."}
          primaryAction={{
            label: "확인",
            onClick: () => {
              setCensoredText(censorText(draftLetter));
              setStage("censorship");
            },
          }}
        />
      )}

      {stage === "censorship" && (
        <MessengerBox
          speaker="검토 중..."
          text={`${censoredText}\n\n(일부 표현이 삭제되었습니다)`}
          primaryAction={{
            label: "확인",
            onClick: () => {
              archiveLetter(censoredText);
              setStage("failed");
            },
          }}
        />
      )}

      {stage === "failed" && (
        <MessengerBox
          speaker="누누"
          text="편지는... 부쳐지지 않았습니다."
          primaryAction={{ label: "확인", onClick: () => setStage("archived") }}
        />
      )}

      {stage === "archived" && (
        <MessengerBox
          speaker="누누"
          text={"이 편지는 '보내지 못한 편지함'에 보관되었습니다.\n다른 사람들의 편지도 그곳에 있어요."}
          primaryAction={{
            label: "편지함 보러가기",
            onClick: () => {
              setStage("idle");
              onGoToArchive();
            },
          }}
          secondaryAction={{ label: "닫기", onClick: () => setStage("idle") }}
        />
      )}
    </div>
  );
}
