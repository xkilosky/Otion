import { useEffect, useRef } from "react";
import type { ConsoleEntry } from "../types";

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  open: boolean;
  errorCount: number;
  onToggle: () => void;
  onClear: () => void;
}

const labels: Record<ConsoleEntry["level"], string> = {
  log: "log",
  info: "info",
  warn: "warn",
  error: "err",
  debug: "dbg",
  system: "sys",
};

export default function ConsolePanel({
  entries,
  open,
  errorCount,
  onToggle,
  onClear,
}: ConsolePanelProps) {
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, open]);

  return (
    <section className={`console ${open ? "is-open" : ""}`} aria-label="Console">
      <button
        type="button"
        className="console__bar"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="console__title">
          Console
          {entries.length > 0 ? <span className="console__count">{entries.length}</span> : null}
          {errorCount > 0 ? (
            <span className="console__errors">
              {errorCount} error{errorCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
        <span className="console__chevron" aria-hidden="true">
          {open ? "▾" : "▴"}
        </span>
      </button>

      {open ? (
        <div className="console__body">
          <div className="console__list" ref={scroller} role="log" aria-live="polite">
            {entries.length === 0 ? (
              <p className="console__empty">
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
          <button type="button" className="console__clear" onClick={onClear}>
            Clear
          </button>
        </div>
      ) : null}
    </section>
  );
}
