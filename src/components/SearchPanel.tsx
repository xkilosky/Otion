import { useEffect, useMemo, useRef, useState } from "react";
import { groupMatches, replaceInFile, searchProject } from "../lib/search";
import type { Project } from "../types";

interface SearchPanelProps {
  project: Project;
  onJump: (fileId: string, line: number, column: number) => void;
  onApplyReplaceAll: (changes: { fileId: string; content: string }[]) => void;
  onClose: () => void;
}

const HIGHLIGHT_CHARS = 200;

/** One tap on a phone beats typing: common things you look for in a page. */
const QUICK_QUERIES = ["console.log", "TODO", "@media", "class=", "id=", "px"];

/**
 * Project-wide search and replace (⌘⇧H). Matches stream in as you type; results
 * are grouped per file and clicking one jumps to that line.
 */
export default function SearchPanel({
  project,
  onJump,
  onApplyReplaceAll,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => input.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const options = { caseSensitive, regex, wholeWord };
  const result = useMemo(
    () => searchProject(project, query, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, query, caseSensitive, regex, wholeWord],
  );
  const groups = useMemo(() => groupMatches(result.matches), [result.matches]);

  const quickQueries = useMemo(
    () =>
      QUICK_QUERIES.map((term) => ({
        term,
        count: searchProject(project, term, { limit: 200 }).matches.length,
      })).filter((entry) => entry.count > 0),
    [project],
  );

  const replaceAll = () => {
    const changes: { fileId: string; content: string }[] = [];
    for (const file of project.files) {
      const next = replaceInFile(file, query, replacement, options);
      if (next.error) return;
      if (next.count > 0) changes.push({ fileId: file.id, content: next.content });
    }
    if (changes.length) onApplyReplaceAll(changes);
  };

  return (
    <div className="search-panel" role="dialog" aria-label="Search in project">
      <div className="search-panel__head">
        <span className="search-panel__title">Search in project</span>
        <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close search">
          ✕
        </button>
      </div>

      <div className="search-panel__fields">
        <div className="search-panel__row">
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter" && result.matches[0]) {
                const first = result.matches[0];
                onJump(first.fileId, first.line, first.column);
              }
            }}
            placeholder="Find…"
            aria-label="Find"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className={`icon-btn icon-btn--sm ${showReplace ? "icon-btn--accent" : ""}`}
            onClick={() => setShowReplace((value) => !value)}
            aria-label="Toggle replace"
            aria-pressed={showReplace}
            title="Replace"
          >
            ⇄
          </button>
        </div>

        {showReplace ? (
          <div className="search-panel__row">
            <input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Replace with…"
              aria-label="Replace with"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={replaceAll}
              disabled={!result.matches.length}
            >
              All
            </button>
          </div>
        ) : null}

        <div className="search-panel__flags">
          <button
            type="button"
            className={`chip chip--sm ${caseSensitive ? "is-on" : ""}`}
            onClick={() => setCaseSensitive((value) => !value)}
            aria-pressed={caseSensitive}
            title="Match case"
          >
            Aa
          </button>
          <button
            type="button"
            className={`chip chip--sm ${wholeWord ? "is-on" : ""}`}
            onClick={() => setWholeWord((value) => !value)}
            aria-pressed={wholeWord}
            title="Whole word"
          >
            ab|
          </button>
          <button
            type="button"
            className={`chip chip--sm ${regex ? "is-on" : ""}`}
            onClick={() => setRegex((value) => !value)}
            aria-pressed={regex}
            title="Regular expression"
          >
            .*
          </button>
          <span className="search-panel__count">
            {result.error
              ? "Bad pattern"
              : query.trim()
                ? `${result.matches.length}${result.truncated ? "+" : ""} match${
                    result.matches.length === 1 ? "" : "es"
                  } in ${groups.length} file${groups.length === 1 ? "" : "s"}`
                : "Type to search every file"}
          </span>
        </div>
        {result.error ? <p className="search-panel__error">{result.error}</p> : null}

        {query.trim() === "" && quickQueries.length > 0 ? (
          <div className="search-panel__quick" aria-label="Quick searches">
            {quickQueries.map((entry) => (
              <button
                key={entry.term}
                type="button"
                className="search-panel__quick-chip"
                onClick={() => setQuery(entry.term)}
              >
                {entry.term}
                <span>{entry.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="search-panel__results">
        {groups.map((group) => (
          <section key={group.fileId} className="search-panel__group">
            <button
              type="button"
              className="search-panel__file"
              onClick={() => onJump(group.fileId, group.matches[0].line, group.matches[0].column)}
            >
              <span>{group.fileName}</span>
              <span className="search-panel__badge">{group.matches.length}</span>
            </button>
            <ul>
              {group.matches.slice(0, 60).map((match, index) => {
                const before = match.preview.slice(0, match.index);
                const hit = match.preview.slice(match.index, match.index + match.length);
                const after = match.preview.slice(match.index + match.length, HIGHLIGHT_CHARS);
                return (
                  <li key={`${match.line}-${match.column}-${index}`}>
                    <button
                      type="button"
                      className="search-panel__match"
                      onClick={() => onJump(match.fileId, match.line, match.column)}
                    >
                      <span className="search-panel__line">{match.line}</span>
                      <span className="search-panel__preview">
                        {before}
                        <mark>{hit}</mark>
                        {after}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {query.trim() && !result.error && result.matches.length === 0 ? (
          <p className="search-panel__empty">Nothing found.</p>
        ) : null}
      </div>

      {showReplace && result.matches.length > 0 ? (
        <div className="search-panel__bulk">
          <button
            type="button"
            className="btn btn--primary btn--xs"
            onClick={replaceAll}
          >
            Replace all in {groups.length} file{groups.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { replaceInFile };
