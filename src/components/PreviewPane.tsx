import { useEffect, useMemo, useRef, useState } from "react";
import { buildPreviewDocument } from "../lib/preview";
import type { ProjectFile } from "../types";

interface PreviewPaneProps {
  files: ProjectFile[];
  theme: "dark" | "light";
  channel: string;
  autoRun: boolean;
  reloadToken: number;
  onToggleAutoRun: () => void;
  onNotify: (message: string) => void;
}

const DEVICES = [
  { id: "fill", label: "Fill", width: 0 },
  { id: "phone", label: "Phone", width: 390 },
  { id: "tablet", label: "Tablet", width: 768 },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"];

const LIVE_DEBOUNCE = 450;

export default function PreviewPane({
  files,
  theme,
  channel,
  autoRun,
  reloadToken,
  onToggleAutoRun,
  onNotify,
}: PreviewPaneProps) {
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const [device, setDevice] = useState<DeviceId>("fill");

  const built = useMemo(
    () => buildPreviewDocument(files, { channel, theme }),
    [files, theme, channel],
  );

  // `doc` is what the frame actually renders: debounced while live, frozen when
  // paused, and refreshed immediately on an explicit reload.
  const [doc, setDoc] = useState(built);
  const lastBuilt = useRef(built);

  useEffect(() => {
    lastBuilt.current = built;
    if (!autoRun) return;
    const timer = window.setTimeout(() => setDoc(built), LIVE_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [built, autoRun]);

  useEffect(() => {
    if (reloadToken === 0) return;
    setDoc(lastBuilt.current);
  }, [reloadToken]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(doc);
      onNotify("Standalone HTML copied");
    } catch {
      onNotify("Clipboard unavailable");
    }
  };

  const activeDevice = DEVICES.find((item) => item.id === device) ?? DEVICES[0];

  return (
    <section className="pane preview-pane" aria-label="Live preview">
      <div className="preview-bar">
        <div className="segmented segmented--sm" role="group" aria-label="Preview width">
          {DEVICES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === device ? "is-active" : ""}
              onClick={() => setDevice(item.id)}
              aria-pressed={item.id === device}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="preview-bar__actions">
          <button
            type="button"
            className={`toggle ${autoRun ? "is-on" : ""}`}
            onClick={onToggleAutoRun}
            role="switch"
            aria-checked={autoRun}
            title="Rebuild the preview as you type"
          >
            <span className="toggle__dot" aria-hidden="true" />
            Live
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={copy}
            title="Copy standalone HTML"
            aria-label="Copy standalone HTML"
          >
            ⧉
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--accent"
            onClick={() => {
              setDoc(lastBuilt.current);
              onNotify("Preview reloaded");
            }}
            title="Reload preview"
            aria-label="Reload preview"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="preview-stage">
        <div
          className="preview-frame-wrap"
          style={activeDevice.width ? { maxWidth: `${activeDevice.width}px` } : undefined}
        >
          <div className="preview-frame-chrome" aria-hidden="true">
            <span />
            <span />
            <span />
            <em>{activeDevice.width ? `${activeDevice.width}px` : "fluid"}</em>
          </div>
          <iframe
            ref={iframe}
            title="Otion live preview"
            className="preview-frame"
            srcDoc={doc}
            sandbox="allow-scripts allow-modals allow-popups allow-forms allow-same-origin"
          />
        </div>
      </div>
    </section>
  );
}
