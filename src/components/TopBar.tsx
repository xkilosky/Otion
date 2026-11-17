import type { MobileView } from "../types";

interface TopBarProps {
  projectName: string;
  onRenameProject: () => void;
  mobileView: MobileView;
  onMobileView: (view: MobileView) => void;
  autoRun: boolean;
  onToggleAutoRun: () => void;
  onOpenFiles: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
}

export default function TopBar({
  projectName,
  onRenameProject,
  mobileView,
  onMobileView,
  autoRun,
  onToggleAutoRun,
  onOpenFiles,
  onOpenTemplates,
  onOpenSettings,
}: TopBarProps) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn topbar__files"
        onClick={onOpenFiles}
        aria-label="Open file list"
      >
        ☰
      </button>

      <button type="button" className="brand" onClick={onRenameProject} title="Rename project">
        <span className="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M8.4 4.6 3.5 12l4.9 7.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15.6 4.6 20.5 12l-4.9 7.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="1.9" fill="currentColor" />
          </svg>
        </span>
        <span className="brand__text">
          <em>Otion</em>
          <small>{projectName}</small>
        </span>
      </button>

      <div className="topbar__mobile-switch segmented" role="group" aria-label="Mobile pane">
        <button
          type="button"
          className={mobileView === "editor" ? "is-active" : ""}
          onClick={() => onMobileView("editor")}
          aria-pressed={mobileView === "editor"}
        >
          Code
        </button>
        <button
          type="button"
          className={mobileView === "preview" ? "is-active" : ""}
          onClick={() => onMobileView("preview")}
          aria-pressed={mobileView === "preview"}
        >
          Preview
        </button>
      </div>

      <div className="topbar__actions">
        <button
          type="button"
          className={`icon-btn topbar__live ${autoRun ? "icon-btn--live" : ""}`}
          onClick={onToggleAutoRun}
          aria-label={autoRun ? "Pause live preview" : "Enable live preview"}
          title={autoRun ? "Live preview on" : "Live preview paused"}
        >
          <span className="pulse-dot" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn topbar__templates"
          onClick={onOpenTemplates}
          aria-label="New from template"
          title="New from template"
        >
          ✦
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
