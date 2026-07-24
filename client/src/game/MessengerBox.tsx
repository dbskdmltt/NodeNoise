interface MessengerAction {
  label: string;
  onClick: () => void;
}

interface MessengerBoxProps {
  speaker: string;
  text: string;
  primaryAction: MessengerAction;
  secondaryAction?: MessengerAction;
}

export function MessengerBox({ speaker, text, primaryAction, secondaryAction }: MessengerBoxProps) {
  return (
    <div className="messenger-overlay">
      <div className="messenger-tab">{speaker}</div>
      <div className="messenger-box">
        <div className="messenger-text">{text}</div>
        <div className="messenger-actions">
          {secondaryAction && (
            <button className="messenger-btn messenger-btn-secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
          <button className="messenger-btn messenger-btn-primary" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        </div>
      </div>
    </div>
  );
}
