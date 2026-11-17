import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";

interface MinimapProps {
  view: EditorView | null;
  value: string;
  fileName: string;
  visible: boolean;
  onJump: (ratio: number) => void;
}

/**
 * VS Code-style minimap: the document rendered as tiny marks (one column per
 * character, capped), with a viewport indicator. Not a full canvas clone — cheap
 * enough to re-render on every keystroke on a phone, and purely decorative.
 */
const MAX_LINES = 900;
const COLORS: Record<string, string> = {
  html: "rgba(255, 61, 139, 0.55)",
  css: "rgba(79, 227, 255, 0.55)",
  js: "rgba(216, 255, 102, 0.5)",
};

export default function Minimap({ view, value, fileName, visible, onJump }: MinimapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 1 });
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  const lines = value.split("\n").slice(0, MAX_LINES);
  const accent = COLORS[ext] ?? "rgba(240, 244, 255, 0.28)";

  useEffect(() => {
    if (!view || !visible) return;
    const update = () => {
      const scroller = view.scrollDOM;
      const total = Math.max(scroller.scrollHeight, 1);
      setViewport({
        top: scroller.scrollTop / total,
        height: Math.max(scroller.clientHeight / total, 0.06),
      });
    };
    update();
    view.scrollDOM.addEventListener("scroll", update, { passive: true });
    // Guarded: ResizeObserver is missing in jsdom and older embedded webviews.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(view.scrollDOM);
    return () => {
      view.scrollDOM.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [view, visible, value]);

  if (!visible) return null;

  return (
    <div
      className="minimap"
      ref={host}
      aria-hidden="true"
      onPointerDown={(event) => {
        const rect = host.current?.getBoundingClientRect();
        if (!rect) return;
        onJump((event.clientY - rect.top) / rect.height);
      }}
    >
      <div className="minimap__code">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return <span key={index} className="minimap__blank" />;
          const indent = line.length - line.trimStart().length;
          return (
            <span
              key={index}
              className="minimap__line"
              style={{
                marginLeft: `${Math.min(indent, 12) * 2}px`,
                width: `${Math.min(trimmed.length * 1.4, 100)}%`,
                background: accent,
                opacity: trimmed.startsWith("//") || trimmed.startsWith("<!--") ? 0.35 : 0.85,
              }}
            />
          );
        })}
      </div>
      <div
        className="minimap__viewport"
        style={{ top: `${viewport.top * 100}%`, height: `${viewport.height * 100}%` }}
      />
    </div>
  );
}
