import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "./components/TopBar";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import ConsolePanel from "./components/ConsolePanel";
import FileList from "./components/FileList";
import Sheet from "./components/Sheet";
import SettingsSheet from "./components/SettingsSheet";
import TemplatePicker from "./components/TemplatePicker";
import Toast, { useToast } from "./components/Toast";
import {
  loadActiveFileId,
  loadPrefs,
  loadProject,
  saveActiveFileId,
  savePrefs,
  saveProject,
} from "./lib/storage";
import { makeFile, projectFromTemplate, starterProject } from "./lib/templates";
import { formatCode } from "./lib/format";
import type { ConsoleEntry, Project, UiPrefs } from "./types";

const CONSOLE_LIMIT = 300;
const QUICK_NAMES = ["index.html", "styles.css", "script.js", "README.md"];

let entrySeq = 0;

const newChannel = () => `otion-${Math.random().toString(36).slice(2, 10)}`;

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject());
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadPrefs());
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [channel, setChannel] = useState(newChannel);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [addingFile, setAddingFile] = useState(false);

  const { toast, notify } = useToast();
  const channelRef = useRef(channel);
  const saveTimer = useRef<number | null>(null);

  const activeFile = useMemo(
    () =>
      project.files.find((file) => file.id === activeFileId) ??
      project.files[0] ??
      null,
    [project.files, activeFileId],
  );

  // Restore the file that was open last session (falls back to the first file).
  useEffect(() => {
    const remembered = loadActiveFileId();
    if (remembered && project.files.some((file) => file.id === remembered)) {
      setActiveFileId(remembered);
    }
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveActiveFileId(activeFile?.id ?? null);
  }, [activeFile?.id]);

  /* --------------------------------- effects -------------------------------- */

  useEffect(() => {
    savePrefs(prefs);
    document.documentElement.dataset.theme = prefs.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", prefs.theme === "dark" ? "#0b0e17" : "#f5f6fb");
  }, [prefs]);

  // Debounced autosave of the whole project.
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const ok = saveProject(project);
      setSaveError(!ok);
      if (ok) setSavedAt(Date.now());
    }, 450);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [project]);

  // Console bridge: only messages from the current preview channel count.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            __otion?: boolean;
            channel?: string;
            level?: ConsoleEntry["level"];
            text?: string;
          }
        | undefined;
      if (!data?.__otion || data.channel !== channelRef.current) return;

      entrySeq += 1;
      const next: ConsoleEntry = {
        id: entrySeq,
        level: data.level ?? "log",
        text: String(data.text ?? ""),
        time: Date.now(),
      };
      setEntries((current) => {
        const merged = [...current, next];
        return merged.length > CONSOLE_LIMIT ? merged.slice(-CONSOLE_LIMIT) : merged;
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const errorCount = useMemo(
    () => entries.filter((entry) => entry.level === "error").length,
    [entries],
  );

  useEffect(() => {
    if (errorCount > 0) setConsoleOpen(true);
  }, [errorCount]);

  // The on-screen keyboard shrinks the visual viewport on phones; mirror that so
  // the editor keeps the caret above the keyboard instead of behind it.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const hidden = covered > 140;
      setKeyboardOpen(hidden);
      // Height comes straight from the visual viewport so the shell is correct
      // whether the keyboard overlays the page (iOS) or resizes it (Android).
      document.documentElement.style.setProperty("--app-height", `${Math.round(viewport.height)}px`);
      document.documentElement.style.setProperty("--kb-inset", `${hidden ? covered : 0}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  /* --------------------------------- actions -------------------------------- */

  const patchPrefs = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((current) => ({ ...current, ...patch }));
  }, []);

  const updateActiveFile = useCallback(
    (content: string) => {
      const target = activeFile;
      if (!target) return;
      setProject((current) => ({
        ...current,
        files: current.files.map((file) =>
          file.id === target.id ? { ...file, content } : file,
        ),
      }));
    },
    [activeFile],
  );

  const formatActiveFile = useCallback(() => {
    const target = activeFile;
    if (!target) return;
    setProject((current) => ({
      ...current,
      files: current.files.map((file) =>
        file.id === target.id
          ? { ...file, content: formatCode(file.content, file.name) }
          : file,
      ),
    }));
  }, [activeFile]);

  const selectFile = useCallback((id: string) => {
    setActiveFileId(id);
    setFilesOpen(false);
  }, []);

  const openNewFile = useCallback(() => {
    setFilesOpen(false);
    setNewFileName("");
    setAddingFile(true);
  }, []);

  const addFile = useCallback(() => {
    const fallback = `file${project.files.length + 1}.js`;
    const name = (newFileName.trim() || fallback).replace(/\s+/g, "-");
    if (project.files.some((file) => file.name.toLowerCase() === name.toLowerCase())) {
      notify(`"${name}" already exists`, "error");
      return;
    }
    const file = makeFile(name, "");
    setProject((current) => ({ ...current, files: [...current.files, file] }));
    setActiveFileId(file.id);
    setAddingFile(false);
    setNewFileName("");
    notify(`Created ${name}`);
  }, [newFileName, project.files, notify]);

  const renameFile = useCallback((id: string, name: string) => {
    setProject((current) => ({
      ...current,
      files: current.files.map((file) => (file.id === id ? { ...file, name } : file)),
    }));
  }, []);

  const deleteFile = useCallback(
    (id: string) => {
      if (project.files.length <= 1) {
        notify("Keep at least one file", "error");
        return;
      }
      const remaining = project.files.filter((file) => file.id !== id);
      setProject((current) => ({ ...current, files: remaining }));
      setActiveFileId((current) => (current === id ? (remaining[0]?.id ?? null) : current));
      notify("File deleted");
    },
    [project.files, notify],
  );

  const renameProject = useCallback(() => {
    const next = window.prompt("Project name", project.name);
    if (next?.trim()) setProject((current) => ({ ...current, name: next.trim() }));
  }, [project.name]);

  const runPreview = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const runFromEditor = useCallback(() => {
    runPreview();
    if (window.innerWidth < 860) patchPrefs({ mobileView: "preview" });
  }, [runPreview, patchPrefs]);

  const loadTemplate = useCallback(
    (templateId: string) => {
      const next = projectFromTemplate(templateId);
      setProject(next);
      setActiveFileId(next.files[0]?.id ?? null);
      setEntries([]);
      setConsoleOpen(false);
      setTemplatesOpen(false);
      setChannel(newChannel());
      notify(`${next.name} loaded`);
    },
    [notify],
  );

  const exportProject = useCallback(() => {
    const payload = {
      app: "Otion",
      version: 1,
      exportedAt: new Date().toISOString(),
      id: project.id,
      name: project.name,
      files: project.files.map(({ name, content }) => ({ name, content })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "otion-project"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Project exported");
  }, [project, notify]);

  const importProject = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json) as Partial<Project>;
        if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
          throw new Error("No files in project");
        }
        const next: Project = {
          id: parsed.id ?? `p_${Date.now().toString(36)}`,
          name: parsed.name ?? "Imported project",
          files: parsed.files.map((file, index) =>
            makeFile(
              file.name || `file${index + 1}.txt`,
              typeof file.content === "string" ? file.content : "",
            ),
          ),
        };
        setProject(next);
        setActiveFileId(next.files[0]?.id ?? null);
        setSettingsOpen(false);
        setChannel(newChannel());
        notify("Project imported");
      } catch {
        notify("That file isn't an Otion project", "error");
      }
    },
    [notify],
  );

  const resetWorkspace = useCallback(() => {
    if (!window.confirm("Reset to a fresh workspace? Your current files will be cleared.")) return;
    const next = starterProject();
    setProject(next);
    setActiveFileId(next.files[0]?.id ?? null);
    setEntries([]);
    setSettingsOpen(false);
    setChannel(newChannel());
    notify("Workspace reset");
  }, [notify]);

  const toggleAutoRun = useCallback(() => {
    setAutoRun((value) => {
      notify(value ? "Live preview paused" : "Live preview resumed");
      return !value;
    });
  }, [notify]);

  // Keyboard shortcuts: run and save.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        runPreview();
        if (prefs.mobileView === "editor" && window.innerWidth < 860) {
          patchPrefs({ mobileView: "preview" });
        }
        notify("Preview refreshed");
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        const ok = saveProject(project);
        setSaveError(!ok);
        if (ok) setSavedAt(Date.now());
        notify(ok ? "Saved locally" : "Storage full — export instead", ok ? "info" : "error");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, runPreview, notify, patchPrefs, prefs.mobileView]);

  const savedLabel = saveError
    ? "Storage full"
    : savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Autosave on";

  return (
    <div className={`app app--${prefs.theme} view-${prefs.mobileView}`}>
      <TopBar
        projectName={project.name}
        onRenameProject={renameProject}
        mobileView={prefs.mobileView}
        onMobileView={(view) => patchPrefs({ mobileView: view })}
        autoRun={autoRun}
        onToggleAutoRun={toggleAutoRun}
        onOpenFiles={() => setFilesOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main
        className="workspace"
        data-view={prefs.mobileView}
        data-console={consoleOpen ? "open" : "closed"}
      >
        <aside className="sidebar" aria-label="Project files">
          <div className="sidebar__head">
            <span>Files</span>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={openNewFile}
              aria-label="New file"
            >
              ＋
            </button>
          </div>
          <FileList
            files={project.files}
            activeId={activeFile?.id ?? null}
            onSelect={selectFile}
            onRename={renameFile}
            onDelete={deleteFile}
            onAdd={openNewFile}
          />
          <div className="sidebar__foot">
            <span className={`dot-status ${savedAt && !saveError ? "is-saved" : ""}`} />
            <span>{savedLabel}</span>
          </div>
        </aside>

        <EditorPane
          files={project.files}
          activeFile={activeFile}
          theme={prefs.theme}
          syntax={prefs.syntax}
          fontSize={prefs.fontSize}
          wordWrap={prefs.wordWrap}
          keypad={prefs.keypad}
          visible={prefs.mobileView === "editor"}
          onChange={updateActiveFile}
          onFormat={formatActiveFile}
          onSelectFile={selectFile}
          onOpenFiles={() => setFilesOpen(true)}
          onToggleKeypad={() => patchPrefs({ keypad: !prefs.keypad })}
          onRun={runFromEditor}
          onCursor={(line, column) => setCursor({ line, column })}
          onNotify={notify}
        />

        <PreviewPane
          files={project.files}
          theme={prefs.theme}
          channel={channel}
          autoRun={autoRun}
          reloadToken={reloadToken}
          onToggleAutoRun={toggleAutoRun}
          onNotify={notify}
        />
      </main>

      <ConsolePanel
        entries={entries}
        open={consoleOpen}
        errorCount={errorCount}
        onToggle={() => setConsoleOpen((value) => !value)}
        onClear={() => setEntries([])}
      />

      <footer className={`statusbar ${keyboardOpen ? "is-hidden" : ""}`}>
        <span className="statusbar__item statusbar__item--name">
          {activeFile?.name ?? "—"}
        </span>
        <span className="statusbar__item">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="statusbar__item statusbar__item--hide-sm">
          {project.files.length} file{project.files.length === 1 ? "" : "s"}
        </span>
        <span className="statusbar__spacer" />
        <span className={`statusbar__item ${autoRun ? "is-live" : ""}`}>
          {autoRun ? "● Live" : "Paused"}
        </span>
        <span className="statusbar__item statusbar__item--hide-sm">
          {saveError ? "Not saved" : "Autosaved"}
        </span>
      </footer>

      <Sheet open={filesOpen} title="Project files" onClose={() => setFilesOpen(false)} size="tall">
        <FileList
          files={project.files}
          activeId={activeFile?.id ?? null}
          onSelect={selectFile}
          onRename={renameFile}
          onDelete={deleteFile}
          onAdd={openNewFile}
        />
      </Sheet>

      <Sheet
        open={addingFile}
        title="New file"
        onClose={() => {
          setAddingFile(false);
          setNewFileName("");
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setAddingFile(false);
                setNewFileName("");
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={addFile}>
              Create file
            </button>
          </>
        }
      >
        <label className="field">
          <span>File name</span>
          <input
            value={newFileName}
            onChange={(event) => setNewFileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addFile();
            }}
            placeholder="styles.css"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <div className="quick-names">
          {QUICK_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip ${newFileName === name ? "is-on" : ""}`}
              onClick={() => setNewFileName(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </Sheet>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onChange={patchPrefs}
        onExport={exportProject}
        onImport={importProject}
        onReset={resetWorkspace}
        onOpenTemplates={() => {
          setSettingsOpen(false);
          setTemplatesOpen(true);
        }}
        onNotify={notify}
      />

      <TemplatePicker
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onPick={loadTemplate}
      />

      <Toast toast={toast} />
    </div>
  );
}
