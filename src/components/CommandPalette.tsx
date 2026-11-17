import { useEffect, useMemo, useRef, useState } from "react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keys?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: Command[];
  files: { id: string; name: string }[];
  onClose: () => void;
  onOpenFile: (id: string) => void;
}

/**
 * One keyboard-first surface for everything: commands (`>` prefix), files, and
 * symbol jumps. Matches on words in any order, so "fmt file" finds "Format file".
 */
export default function CommandPalette({
  open,
  commands,
  files,
  onClose,
  onOpenFile,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const timer = window.setTimeout(() => input.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const results = useMemo(() => {
    const raw = query.trim();
    const stripped = raw.replace(/^[>@#]/, "").trim().toLowerCase();
    const fileMode = raw.startsWith("#") || (!raw.startsWith(">") && stripped.length > 0 && files.some((file) => file.name.toLowerCase().includes(stripped)));

    const matches = (text: string) => {
      if (!stripped) return true;
      const words = stripped.split(/\s+/);
      const hay = text.toLowerCase();
      return words.every((word) => hay.includes(word));
    };

    if (fileMode && stripped) {
      return files
        .filter((file) => matches(file.name))
        .slice(0, 20)
        .map((file) => ({
          id: `file:${file.id}`,
          label: file.name,
          group: "Files",
          hint: "open",
          run: () => onOpenFile(file.id),
        })) as Command[];
    }

    return commands.filter((command) => matches(`${command.group} ${command.label}`)).slice(0, 40);
  }, [query, commands, files, onOpenFile]);

  useEffect(() => {
    if (index >= results.length) setIndex(0);
  }, [results.length, index]);

  if (!open) return null;

  const run = (command?: Command) => {
    if (!command) return;
    onClose();
    // Defer so the palette closes before the command steals focus.
    window.setTimeout(command.run, 0);
  };

  return (
    <div className="palette-scrim" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__input-row">
          <span className="palette__glyph" aria-hidden="true">
            ⌘
          </span>
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(results[index]);
              }
            }}
            placeholder="Type a command, or # for a file…"
            aria-label="Search commands and files"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <ul className="palette__list" ref={list}>
          {results.length === 0 ? (
            <li className="palette__empty">No matches</li>
          ) : (
            results.map((command, position) => (
              <li key={command.id}>
                <button
                  type="button"
                  className={`palette__item ${position === index ? "is-active" : ""}`}
                  onMouseEnter={() => setIndex(position)}
                  onClick={() => run(command)}
                >
                  <span className="palette__group">{command.group}</span>
                  <span className="palette__label">{command.label}</span>
                  {command.keys ? <kbd>{command.keys}</kbd> : null}
                  {command.hint ? <span className="palette__hint">{command.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="palette__foot">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
          <span className="palette__foot-hint"># files · &gt; commands</span>
        </div>
      </div>
    </div>
  );
}
