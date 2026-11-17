import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "auto" | "tall";
}

/** Bottom sheet on phones, centered dialog from 720px up. */
export default function Sheet({ open, title, onClose, children, footer, size = "auto" }: SheetProps) {
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-scrim" onPointerDown={(event) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    }}>
      <div
        className={`sheet sheet--${size}`}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
