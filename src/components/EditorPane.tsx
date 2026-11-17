import { useEffect, useRef, useState } from "react";
import CodeEditor, { type EditorHandle } from "./CodeEditor";
import { fileBadge, KEYPAD_LINES, KEYPAD_SYMBOLS } from "../lib/languages";
import { formatKind } from "../lib/format";
import type { ProjectFile } from "../types";

interface EditorPaneProps {
  files: ProjectFile[];
  activeFile: ProjectFile | null;
  theme: "dark" | "light";
  fontSize: number;
  wordWrap: boolean;
  keypad: boolean;
  visible: boolean;
  onChange: (value: string) => void;
  onFormat: () => void;
  onSelectFile: (id: string) => void;
  onOpenFiles: () => void;
  onToggleKeypad: () => void;
  onRun: () => void;
  onCursor: (line: number, column: number) => void;
  onNotify: (message: string) => void;
}

export default function EditorPane({
  files,
  activeFile,
  theme,
  fontSize,
  wordWrap,
  keypad,
  visible,
  onChange,
  onFormat,
  onSelectFile,
  onOpenFiles,
  onToggleKeypad,
  onRun,
  onCursor,
  onNotify,
}: EditorPaneProps) {
  const editor = useRef<EditorHandle | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  // Returning from the Preview tab on a phone: the editor was display:none, so
  // ask CodeMirror to re-measure before the next paint.
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => editor.current?.remeasure());
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const press = (value: string) => {
    editor.current?.insert(value);
    setPressed(value);
    window.setTimeout(
      () => setPressed((current) => (current === value ? null : current)),
      130,
    );
  };

  return (
    <section className="pane editor-pane" aria-label="Code editor">
      <div className="tabbar">
        <button
          type="button"
          className="tabbar__icon"
          onClick={onOpenFiles}
          aria-label="Show file list"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M2.6 5.6h5l1.5 1.9h8.3v6.9a1.4 1.4 0 0 1-1.4 1.4H4a1.4 1.4 0 0 1-1.4-1.4V5.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="tabbar__scroll" role="tablist" aria-label="Open files">
          {files.map((file) => {
            const active = file.id === activeFile?.id;
            return (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`tab ${active ? "is-active" : ""}`}
                onClick={() => onSelectFile(file.id)}
              >
                <span className={`badge badge--${fileBadge(file.name).toLowerCase()}`}>
                  {fileBadge(file.name)}
                </span>
                <span className="tab__name">{file.name}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="tabbar__icon tabbar__icon--accent"
          onClick={() => {
            onRun();
            onNotify("Preview refreshed");
          }}
          aria-label="Run and refresh preview"
          title="Run (⌘↵)"
        >
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M6 4.2v11.6L16 10 6 4.2Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="editor-wrap">
        {activeFile ? (
          <CodeEditor
            key={activeFile.id}
            ref={editor}
            fileName={activeFile.name}
            value={activeFile.content}
            theme={theme}
            fontSize={fontSize}
            wordWrap={wordWrap}
            onChange={onChange}
            onFormat={onFormat}
            onCursor={onCursor}
          />
        ) : (
          <div className="empty-state">
            <p>No file open.</p>
            <button type="button" className="btn btn--ghost" onClick={onOpenFiles}>
              Pick a file
            </button>
          </div>
        )}
      </div>

      <div className="editor-foot">
        <div className="editor-foot__group">
          <button
            type="button"
            className={`chip ${showSnippets ? "is-on" : ""}`}
            onClick={() => setShowSnippets((value) => !value)}
            aria-expanded={showSnippets}
          >
            Snippets
          </button>
          <button
            type="button"
            className={`chip ${keypad ? "is-on" : ""}`}
            onClick={onToggleKeypad}
            aria-pressed={keypad}
          >
            Keys
          </button>
          <button
            type="button"
            className="chip chip--ghost"
            onClick={() => {
              onFormat();
              onNotify(`Formatted (${formatKind(activeFile?.name ?? "")})`);
            }}
            title="Re-indent this file (⌘⇧F)"
          >
            Format
          </button>
        </div>
        <span className="editor-foot__hint">{activeFile?.name ?? "—"}</span>
      </div>

      {showSnippets ? (
        <div className="keypad keypad--snippets" role="toolbar" aria-label="Code snippets">
          {KEYPAD_LINES.map((snippet) => (
            <button
              key={snippet.label}
              type="button"
              className={`key key--wide ${pressed === snippet.insert ? "is-pressed" : ""}`}
              title={snippet.hint}
              onClick={() => press(snippet.insert)}
            >
              {snippet.label}
            </button>
          ))}
        </div>
      ) : null}

      {keypad ? (
        <div className="keypad" role="toolbar" aria-label="Symbol keypad">
          {KEYPAD_SYMBOLS.map((symbol) => (
            <button
              key={symbol.label}
              type="button"
              className={`key ${pressed === symbol.insert ? "is-pressed" : ""}`}
              title={symbol.hint ?? symbol.label}
              onClick={() => press(symbol.insert)}
            >
              {symbol.label}
            </button>
          ))}
          <button
            type="button"
            className="key key--accent"
            onClick={() => editor.current?.indent()}
            aria-label="Insert indentation"
          >
            ⇥
          </button>
        </div>
      ) : null}
    </section>
  );
}
