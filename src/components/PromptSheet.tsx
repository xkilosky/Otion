import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";

interface PromptSheetProps {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  value?: string;
  inputMode?: "text" | "numeric";
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

/** Keyboard-friendly replacement for window.prompt (which mobile Safari hides). */
export default function PromptSheet({
  open,
  title,
  label,
  placeholder,
  value = "",
  inputMode = "text",
  confirmLabel = "OK",
  onClose,
  onSubmit,
}: PromptSheetProps) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    const timer = window.setTimeout(() => input.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open, value]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <label className="field">
        <span>{label}</span>
        <input
          ref={input}
          value={draft}
          inputMode={inputMode}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
    </Sheet>
  );
}
