import Sheet from "./Sheet";
import { presetSwatches } from "../lib/editorTheme";
import type { UiPrefs } from "../types";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  prefs: UiPrefs;
  onChange: (patch: Partial<UiPrefs>) => void;
  onExport: () => void;
  onImport: (projectJson: string) => void;
  onReset: () => void;
  onOpenTemplates: () => void;
  onOpenProjects: () => void;
  onExportAll: () => void;
  projectCount: number;
  onNotify: (message: string) => void;
}

export default function SettingsSheet({
  open,
  onClose,
  prefs,
  onChange,
  onExport,
  onImport,
  onReset,
  onOpenTemplates,
  onOpenProjects,
  onExportAll,
  projectCount,
  onNotify,
}: SettingsSheetProps) {
  const download = () => {
    try {
      onExport();
    } catch {
      onNotify("Could not export project");
    }
  };

  const pickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      onImport(text);
    };
    input.click();
  };

  return (
    <Sheet open={open} title="Settings" onClose={onClose} size="tall">
      <div className="settings-group">
        <h3>Appearance</h3>
        <div className="setting-row">
          <div>
            <strong>Theme</strong>
            <p>Switch the whole workspace, including the preview.</p>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={prefs.theme === "dark" ? "is-active" : ""}
              onClick={() => onChange({ theme: "dark" })}
            >
              Dark
            </button>
            <button
              type="button"
              className={prefs.theme === "light" ? "is-active" : ""}
              onClick={() => onChange({ theme: "light" })}
            >
              Light
            </button>
          </div>
        </div>

        <div className="setting-row setting-row--stack">
          <div>
            <strong>Syntax colours</strong>
            <p>
              {prefs.syntax === "neon"
                ? "Saturated neon: pink JSX tags, green attributes, acid-yellow strings."
                : "Muted, classic editor palette."}
            </p>
          </div>
          <div className="syntax-picker" role="radiogroup" aria-label="Syntax colour preset">
            {(
              [
                { id: "neon", label: "Neon" },
                { id: "classic", label: "Classic" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={prefs.syntax === preset.id}
                className={`syntax-option ${prefs.syntax === preset.id ? "is-active" : ""}`}
                onClick={() => onChange({ syntax: preset.id })}
              >
                <span className="syntax-option__dots" aria-hidden="true">
                  {presetSwatches(preset.id, prefs.theme).map((color, index) => (
                    <i key={index} style={{ background: color }} />
                  ))}
                </span>
                <span className="syntax-option__label">{preset.label}</span>
                {prefs.syntax === preset.id ? (
                  <span className="syntax-option__check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row setting-row--stack">
          <div>
            <strong>Font size</strong>
            <p>{prefs.fontSize.toFixed(1)}px — tuned for thumbs and small screens.</p>
          </div>
          <div className="range-row">
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChange({ fontSize: Math.max(10, prefs.fontSize - 1) })}
              aria-label="Decrease font size"
            >
              A−
            </button>
            <input
              type="range"
              min={10}
              max={22}
              step={0.5}
              value={prefs.fontSize}
              onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
              aria-label="Editor font size"
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChange({ fontSize: Math.min(22, prefs.fontSize + 1) })}
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <strong>Word wrap</strong>
            <p>Wrap long lines instead of scrolling sideways.</p>
          </div>
          <button
            type="button"
            className={`toggle ${prefs.wordWrap ? "is-on" : ""}`}
            onClick={() => onChange({ wordWrap: !prefs.wordWrap })}
            role="switch"
            aria-checked={prefs.wordWrap}
          >
            <span className="toggle__dot" aria-hidden="true" />
            {prefs.wordWrap ? "On" : "Off"}
          </button>
        </div>

        <div className="setting-row">
          <div>
            <strong>Symbol keypad</strong>
            <p>Quick access to brackets, quotes and snippets while typing.</p>
          </div>
          <button
            type="button"
            className={`toggle ${prefs.keypad ? "is-on" : ""}`}
            onClick={() => onChange({ keypad: !prefs.keypad })}
            role="switch"
            aria-checked={prefs.keypad}
          >
            <span className="toggle__dot" aria-hidden="true" />
            {prefs.keypad ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3>Projects · {projectCount}</h3>
        <div className="button-row">
          <button type="button" className="btn btn--ghost" onClick={onOpenProjects}>
            Switch project
          </button>
          <button type="button" className="btn btn--ghost" onClick={onOpenTemplates}>
            New from template
          </button>
        </div>
        <div className="button-row">
          <button type="button" className="btn btn--ghost" onClick={download}>
            Export this project
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExportAll}>
            Export all
          </button>
          <button type="button" className="btn btn--ghost" onClick={pickFile}>
            Import JSON
          </button>
        </div>
        <div className="button-row">
          <button type="button" className="btn btn--danger" onClick={onReset}>
            Reset this project
          </button>
        </div>
        <p className="settings-note">
          Everything lives in this browser's storage — no account, no server. Export to keep a
          backup or move between devices; imports can be a single project or a whole workspace.
        </p>
      </div>

      <div className="settings-group">
        <h3>Layout</h3>
        <div className="setting-row">
          <div>
            <strong>Zen mode</strong>
            <p>Hide the rail, keypad, console and status bar — just code and preview.</p>
          </div>
          <button
            type="button"
            className={`chip ${prefs.zen ? "is-on" : ""}`}
            onClick={() => onChange({ zen: !prefs.zen })}
            aria-pressed={prefs.zen}
          >
            {prefs.zen ? "On" : "Off"}
          </button>
        </div>
        <div className="setting-row setting-row--stack">
          <div>
            <strong>Editor / preview split</strong>
            <p>Drag the divider, or nudge it here. Double-click the divider to reset.</p>
          </div>
          <div className="range-row">
            <button
              type="button"
              className="chip"
              onClick={() => onChange({ split: Math.max(0.18, prefs.split - 0.08) })}
              aria-label="Editor smaller"
            >
              −
            </button>
            <input
              type="range"
              min={18}
              max={82}
              step={2}
              value={Math.round(prefs.split * 100)}
              onChange={(event) => onChange({ split: Number(event.target.value) / 100 })}
              aria-label="Editor share of the workspace"
            />
            <button
              type="button"
              className="chip"
              onClick={() => onChange({ split: Math.min(0.82, prefs.split + 0.08) })}
              aria-label="Editor larger"
            >
              ＋
            </button>
            <span className="range-row__value">{Math.round(prefs.split * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>Tips & shortcuts</h3>
        <ul className="tips">
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>↵</kbd> — run the preview</li>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>S</kbd> — save to this browser</li>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>F</kbd> — format the file</li>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>F</kbd> — find inside the file</li>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>E</kbd> — switch project</li>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>H</kbd> — search the project</li>
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>Z</kbd> — zen mode</li>
          <li>On a phone, tap <strong>Preview</strong> in the header to see your page full-screen.</li>
          <li>Templates inline every file into one HTML document — export or copy it any time.</li>
        </ul>
      </div>

      <div className="settings-group">
        <h3>About</h3>
        <p className="settings-note">
          Otion — a mobile-first code editor for the web. Built with React and CodeMirror 6.
          Everything runs in your browser.
        </p>
      </div>
    </Sheet>
  );
}
