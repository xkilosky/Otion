import { useEffect, useRef } from "react";
import type { ConsoleEntry } from "../types";

export interface Problem {
  id: string;
  fileId: string;
  fileName: string;
  line: number;
  severity: "error" | "warning";
  message: string;
}

interface BottomDockProps {
  tab: "output" | "problems" | "closed";
  onTab: (tab: "output" | "problems" | "closed") => void;
  entries: ConsoleEntry[];
  errorCount: number;
  problems: Problem[];
  problemsSummary: { errors: number; warnings: number };
  onClear: () => void;
  onOpenProblem: (problem: Problem) => void;
}

const labels: Record<ConsoleEntry["level"], string> = {
  log: "log",
  info: "info",
  warn: "warn",
  error: "err",
  debug: "dbg",
  system: "sys",
};

/**
 * One dock, two faces — Output and Problems — the way a code editor does it,
 * instead of two competing panels eating the same corner of the screen.
 */
export default function BottomDock({
  tab,
  onTab,
  entries,
  errorCount,
  problems,
  problemsSummary,
  onClear,
  onOpenProblem,
}: BottomDockProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const open = tab !== "closed";

  useEffect(() => {
    if (tab !== "output") return;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, tab]);

  const toggle = (next: "output" | "problems") => onTab(tab === next ? "closed" : next);

  return (
    <section className={`dock ${open ? "is-open" : ""}`} aria-label="Output and problems">
      <div className="dock__tabs">
        <button
          type="button"
          className={`dock__tab ${tab === "output" ? "is-active" : ""}`}
          onClick={() => toggle("output")}
          aria-expanded={tab === "output"}
        >
          Output
          {entries.length > 0 ? <span className="dock__count">{entries.length}</span> : null}
          {errorCount > 0 ? <span className="dock__dot is-error" aria-hidden="true" /> : null}
        </button>
        <button
          type="button"
          className={`dock__tab ${tab === "problems" ? "is-active" : ""}`}
          onClick={() => toggle("problems")}
          aria-expanded={tab === "problems"}
        >
          Problems
          <span className={`dock__count ${problemsSummary.errors ? "is-error" : ""}`}>
            {problemsSummary.errors + problemsSummary.warnings}
          </span>
        </button>
        <span className="dock__spacer" />
        {open ? (
          <button
            type="button"
            className="dock__action"
            onClick={tab === "output" ? onClear : () => onTab("closed")}
          >
            {tab === "output" ? "Clear" : "Close"}
          </button>
        ) : null}
        <span className="dock__chevron" aria-hidden="true">
          {open ? "▾" : "▴"}
        </span>
      </div>

      {open ? (
        <div className="dock__body">
          {tab === "output" ? (
            <div className="dock__list" ref={scroller} role="log" aria-live="polite">
              {entries.length === 0 ? (
                <p className="dock__empty">
                  Console output from your preview shows up here — try{" "}
                  <code>console.log("hi")</code>.
                </p>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className={`log log--${entry.level}`}>
                    <span className="log__level">{labels[entry.level]}</span>
                    <span className="log__text">{entry.text}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="dock__list">
              {problems.length === 0 ? (
                <p className="dock__empty">No problems in this file. ✓</p>
              ) : (
                problems.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    className={`dock__problem is-${problem.severity}`}
                    onClick={() => onOpenProblem(problem)}
                  >
                    <span className="dock__problem-icon" aria-hidden="true">
                      {problem.severity === "error" ? "✕" : "!"}
                    </span>
                    <span className="dock__problem-file">{problem.fileName}</span>
                    <span className="dock__problem-line">{problem.line}</span>
                    <span className="dock__problem-msg">{problem.message}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
