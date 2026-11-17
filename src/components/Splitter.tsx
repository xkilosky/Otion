import { useCallback, useEffect, useRef, useState } from "react";

interface SplitterProps {
  /** Current editor share of the workspace, 0–1. */
  value: number;
  onChange: (next: number) => void;
  /** Called on pointer-up so callers can coalesce persistence. */
  onCommit?: (next: number) => void;
}

/**
 * Drag handle between the editor and the preview. Pointer-driven (so it works
 * with a mouse, a stylus and a finger), keyboard accessible, and it never
 * captures the whole page — only the 14px gutter.
 */
export default function Splitter({ value, onChange, onCommit }: SplitterProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const [active, setActive] = useState(false);
  const [nudge, setNudge] = useState(0);

  const ratioFrom = useCallback((clientX: number) => {
    const workspace = host.current?.parentElement;
    if (!workspace) return value;
    const rect = workspace.getBoundingClientRect();
    if (rect.width === 0) return value;
    return (clientX - rect.left) / rect.width;
  }, [value]);

  useEffect(() => {
    if (!active) return;

    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      event.preventDefault();
      onChange(ratioFrom(event.clientX));
    };
    const up = () => {
      if (dragging.current) onCommit?.(value);
      dragging.current = false;
      setActive(false);
      document.body.classList.remove("is-resizing");
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("is-resizing");
    };
  }, [active, onChange, onCommit, ratioFrom, value]);

  // Announce the split for screen readers without spamming the live region.
  useEffect(() => {
    if (!active) setNudge(0);
  }, [active]);

  const step = (delta: number) => {
    const next = Math.min(0.82, Math.max(0.18, value + delta));
    onChange(next);
    onCommit?.(next);
    setNudge(Math.round(next * 100));
  };

  return (
    <div
      className={`splitter ${active ? "is-active" : ""}`}
      ref={host}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize editor and preview"
      aria-valuemin={18}
      aria-valuemax={82}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        dragging.current = true;
        setActive(true);
        document.body.classList.add("is-resizing");
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onDoubleClick={() => {
        onChange(0.5);
        onCommit?.(0.5);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          step(event.key === "ArrowLeft" ? -0.04 : 0.04);
        } else if (event.key === "Enter" || event.key === "Home") {
          event.preventDefault();
          onChange(0.5);
          onCommit?.(0.5);
          setNudge(50);
        }
      }}
    >
      <span className="splitter__grip" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="visually-hidden" aria-live="polite">
        {nudge ? `Editor ${nudge}%` : ""}
      </span>
    </div>
  );
}
