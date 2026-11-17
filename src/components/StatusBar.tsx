import type { EditorStats } from "./CodeEditor";

interface StatusBarProps {
  fileName: string;
  language: string;
  cursor: { line: number; column: number };
  selection: number;
  stats: EditorStats;
  autoRun: boolean;
  savedLabel: string;
  saveError: boolean;
  onOpenProblems: () => void;
  onGoToLine: () => void;
  onOpenSettings: () => void;
}

export default function StatusBar({
  fileName,
  language,
  cursor,
  selection,
  stats,
  autoRun,
  savedLabel,
  saveError,
  onOpenProblems,
  onGoToLine,
  onOpenSettings,
}: StatusBarProps) {
  return (
    <footer className="statusbar" role="contentinfo">
      <button type="button" className="statusbar__item statusbar__item--button" onClick={onOpenProblems}>
        <span className={`status-dot ${autoRun ? "is-live" : ""}`} aria-hidden="true" />
        {autoRun ? "Live" : "Paused"}
      </button>
      <span className="statusbar__item">
        {stats.errors > 0 || stats.warnings > 0 ? (
          <button type="button" className="statusbar__problems" onClick={onOpenProblems}>
            <span className="statusbar__badge is-error" title={`${stats.errors} errors`}>
              ✕ {stats.errors}
            </span>
            <span className="statusbar__badge is-warning" title={`${stats.warnings} warnings`}>
              ! {stats.warnings}
            </span>
          </button>
        ) : (
          <span className="statusbar__clean">✓ no problems</span>
        )}
      </span>
      <span className="statusbar__spacer" />
      <span className="statusbar__item statusbar__item--hide-sm">{stats.lines} lines</span>
      <span className="statusbar__item statusbar__item--hide-sm">{stats.words} words</span>
      <span className="statusbar__item statusbar__item--hide-sm">{language}</span>
      <span className="statusbar__item">
        {selection > 0 ? `${selection} selected` : `Ln ${cursor.line}, Col ${cursor.column}`}
      </span>
      <button
        type="button"
        className="statusbar__item statusbar__item--button statusbar__item--hide-sm"
        onClick={onGoToLine}
      >
        Go to line
      </button>
      <button
        type="button"
        className="statusbar__item statusbar__item--button statusbar__item--hide-sm"
        onClick={onOpenSettings}
      >
        {saveError ? "Not saved" : savedLabel}
      </button>
      <span className="statusbar__item statusbar__item--name" title={fileName}>
        {fileName}
      </span>
    </footer>
  );
}
