import type { MobileView } from "../types";

const MOBILE_TABS: { id: MobileView; label: string; icon: string; hint: string }[] = [
  { id: "editor", label: "Code", icon: "❯_", hint: "Code only" },
  { id: "split", label: "Split", icon: "⬓", hint: "Code above, preview below" },
  { id: "preview-first", label: "Preview first", icon: "⬒", hint: "Preview above, code below" },
  { id: "preview", label: "Preview", icon: "▣", hint: "Preview only" },
];

interface TopBarProps {
  projectName: string;
  projectCount: number;
  onRenameProject: () => void;
  onOpenProjects: () => void;
  onSearch: () => void;
  mobileView: MobileView;
  onMobileView: (view: MobileView) => void;
  autoRun: boolean;
  onToggleAutoRun: () => void;
  onOpenFiles: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  onToggleZen: () => void;
  zen: boolean;
}

export default function TopBar({
  projectName,
  projectCount,
  onRenameProject,
  onOpenProjects,
  onSearch,
  mobileView,
  onMobileView,
  autoRun,
  onToggleAutoRun,
  onOpenFiles,
  onOpenTemplates,
  onOpenSettings,
  onToggleZen,
  zen,
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

      <button
        type="button"
        className="topbar__projects topbar__optional"
        onClick={onOpenProjects}
        aria-label={`Switch project (${projectCount} projects)`}
        title="Switch project (⌘⇧E)"
      >
        <span aria-hidden="true">▦</span>
        <span className="topbar__projects-count">{projectCount}</span>
      </button>

      <button
        type="button"
        className="icon-btn topbar__search topbar__optional"
        onClick={onSearch}
        aria-label="Search in project"
        title="Search in project (⌘⇧H)"
      >
        ⌕
      </button>

      <div className="topbar__mobile-switch segmented segmented--sm" role="group" aria-label="Phone layout">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={mobileView === tab.id ? "is-active" : ""}
            onClick={() => onMobileView(tab.id)}
            aria-pressed={mobileView === tab.id}
            title={tab.hint}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span className="visually-hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="topbar__actions">
        <button
          type="button"
          className={`icon-btn topbar__live topbar__optional ${autoRun ? "icon-btn--live" : ""}`}
          onClick={onToggleAutoRun}
          aria-label={autoRun ? "Pause live preview" : "Enable live preview"}
          title={autoRun ? "Live preview on" : "Live preview paused"}
        >
          <span className="pulse-dot" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn topbar__templates topbar__optional"
          onClick={onOpenTemplates}
          aria-label="New from template"
          title="New from template"
        >
          ✦
        </button>
        <button
          type="button"
          className={`icon-btn topbar__zen topbar__optional ${zen ? "icon-btn--accent" : ""}`}
          onClick={onToggleZen}
          aria-label={zen ? "Exit zen mode" : "Zen mode"}
          aria-pressed={zen}
          title="Zen mode (⌘⇧Z)"
        >
          ⤢
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
