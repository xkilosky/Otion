import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "./components/TopBar";
import EditorPane, { type EditorCommand } from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import ConsolePanel from "./components/ConsolePanel";
import FileList from "./components/FileList";
import Sheet from "./components/Sheet";
import SettingsSheet from "./components/SettingsSheet";
import TemplatePicker from "./components/TemplatePicker";
import Toast, { useToast } from "./components/Toast";
import StatusBar from "./components/StatusBar";
import CommandPalette, { type Command } from "./components/CommandPalette";
import PromptSheet from "./components/PromptSheet";
import type { EditorStats } from "./components/CodeEditor";
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
import type { EditorView } from "@codemirror/view";
import { languageLabel } from "./lib/languages";
import type { ConsoleEntry, Project, UiPrefs } from "./types";

const CONSOLE_LIMIT = 300;
const QUICK_NAMES = ["index.html", "styles.css", "script.js", "README.md"];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A command without its auto-assigned nonce. */
type EditorCommandInput = DistributiveOmit<EditorCommand, "nonce">;

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
  const [filesOpen, setFilesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [addingFile, setAddingFile] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [prompt, setPrompt] = useState<
    | null
    | {
        title: string;
        label: string;
        value?: string;
        inputMode?: "text" | "numeric";
        confirmLabel?: string;
        onSubmit: (value: string) => void;
      }
  >(null);
  const [stats, setStats] = useState<EditorStats>({
    lines: 0,
    words: 0,
    chars: 0,
    errors: 0,
    warnings: 0,
  });
  // The live EditorView, shared with the command palette and status bar.
  const editorViewRef = useRef<EditorView | null>(null);
  const [selectionLength, setSelectionLength] = useState(0);
  const [command, setCommand] = useState<EditorCommand | null>(null);

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
      document.body.classList.toggle("kb-open", hidden);
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
    setPrompt({
      title: "Rename project",
      label: "Project name",
      value: project.name,
      confirmLabel: "Rename",
      onSubmit: (next) => setProject((current) => ({ ...current, name: next })),
    });
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

  const dispatchCommand = useCallback((next: EditorCommandInput) => {
    setCommand({ ...next, nonce: Date.now() } as EditorCommand);
  }, []);

  const saveNow = useCallback(() => {
    const ok = saveProject(project);
    setSaveError(!ok);
    if (ok) setSavedAt(Date.now());
    notify(ok ? "Saved locally" : "Storage full — export instead", ok ? "info" : "error");
    return ok;
  }, [project, notify]);

  const openProblems = useCallback(() => {
    if (prefs.mobileView === "preview") patchPrefs({ mobileView: "editor" });
    dispatchCommand({ kind: "problems" });
  }, [dispatchCommand, patchPrefs, prefs.mobileView]);

  const openSearch = useCallback(() => {
    if (prefs.mobileView === "preview") patchPrefs({ mobileView: "editor" });
    dispatchCommand({ kind: "search" });
  }, [dispatchCommand, patchPrefs, prefs.mobileView]);

  const goToLine = useCallback(() => {
    if (prefs.mobileView === "preview") patchPrefs({ mobileView: "editor" });
    setPrompt({
      title: "Go to line",
      label: "Line number",
      inputMode: "numeric",
      value: String(cursor.line),
      confirmLabel: "Go",
      onSubmit: (value) => {
        const line = Number.parseInt(value, 10);
        if (!Number.isFinite(line)) {
          notify("Enter a line number", "error");
          return;
        }
        dispatchCommand({ kind: "goToLine", line });
      },
    });
  }, [cursor.line, dispatchCommand, notify, patchPrefs, prefs.mobileView]);

  // Global shortcuts: run, save, palette, problems, search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.key === "Enter") {
        event.preventDefault();
        runPreview();
        if (prefs.mobileView === "editor" && window.innerWidth < 860) {
          patchPrefs({ mobileView: "preview" });
        }
        notify("Preview refreshed");
      } else if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        saveNow();
      } else if (key === "p" && event.shiftKey) {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (key === "p") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (key === "f" && event.shiftKey) {
        event.preventDefault();
        openProblems();
      } else if (key === "j") {
        event.preventDefault();
        setConsoleOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runPreview, notify, patchPrefs, prefs.mobileView, saveNow, openProblems]);

  const savedLabel = saveError
    ? "Storage full"
    : savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Autosave on";

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "run",
        label: "Run / refresh preview",
        group: "Preview",
        keys: "⌘↵",
        run: () => {
          runPreview();
          notify("Preview refreshed");
        },
      },
      {
        id: "toggle-run",
        label: autoRun ? "Pause live preview" : "Resume live preview",
        group: "Preview",
        run: toggleAutoRun,
      },
      {
        id: "save",
        label: "Save workspace",
        group: "File",
        keys: "⌘S",
        run: () => {
          saveNow();
        },
      },
      {
        id: "new-file",
        label: "New file",
        group: "File",
        run: openNewFile,
      },
      {
        id: "templates",
        label: "New from template",
        group: "File",
        run: () => setTemplatesOpen(true),
      },
      {
        id: "export",
        label: "Export project as JSON",
        group: "File",
        run: exportProject,
      },
      {
        id: "format",
        label: "Format document",
        group: "Editor",
        keys: "⇧⌥F",
        run: () => dispatchCommand({ kind: "format" }),
      },
      {
        id: "format-file",
        label: `Format ${activeFile?.name ?? "file"} and save`,
        group: "Editor",
        run: formatActiveFile,
      },
      {
        id: "search",
        label: "Find in file",
        group: "Editor",
        keys: "⌘F",
        run: openSearch,
      },
      {
        id: "problems",
        label: "Show problems",
        group: "View",
        keys: "⌘⇧F8",
        run: openProblems,
      },
      {
        id: "goto",
        label: "Go to line…",
        group: "Navigate",
        keys: "⌘G",
        run: goToLine,
      },
      {
        id: "files",
        label: "Show all files",
        group: "Navigate",
        run: () => setFilesOpen(true),
      },
      {
        id: "minimap",
        label: prefs.minimap ? "Hide minimap" : "Show minimap",
        group: "View",
        run: () => patchPrefs({ minimap: !prefs.minimap }),
      },
      {
        id: "wrap",
        label: prefs.wordWrap ? "Turn off word wrap" : "Turn on word wrap",
        group: "View",
        run: () => patchPrefs({ wordWrap: !prefs.wordWrap }),
      },
      {
        id: "keypad",
        label: prefs.keypad ? "Hide keypad" : "Show keypad",
        group: "View",
        run: () => patchPrefs({ keypad: !prefs.keypad }),
      },
      {
        id: "console",
        label: consoleOpen ? "Hide console" : "Show console",
        group: "View",
        keys: "⌘J",
        run: () => setConsoleOpen((value) => !value),
      },
      {
        id: "theme",
        label: `Switch to ${prefs.theme === "dark" ? "light" : "dark"} theme`,
        group: "Theme",
        run: () => patchPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" }),
      },
      {
        id: "syntax",
        label: `Use ${prefs.syntax === "neon" ? "Classic" : "Neon"} syntax`,
        group: "Theme",
        run: () => patchPrefs({ syntax: prefs.syntax === "neon" ? "classic" : "neon" }),
      },
      {
        id: "settings",
        label: "Open settings",
        group: "App",
        run: () => setSettingsOpen(true),
      },
      {
        id: "rename-project",
        label: "Rename project",
        group: "App",
        run: renameProject,
      },
    ];
    return list;
  }, [
    activeFile?.name,
    autoRun,
    consoleOpen,
    dispatchCommand,
    exportProject,
    formatActiveFile,
    goToLine,
    notify,
    openNewFile,
    openProblems,
    openSearch,
    patchPrefs,
    prefs.keypad,
    prefs.minimap,
    prefs.syntax,
    prefs.theme,
    prefs.wordWrap,
    renameProject,
    runPreview,
    saveNow,
    toggleAutoRun,
  ]);

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
          minimap={prefs.minimap}
          visible={prefs.mobileView === "editor"}
          onChange={updateActiveFile}
          onFormat={formatActiveFile}
          onSelectFile={selectFile}
          onOpenFiles={() => setFilesOpen(true)}
          onToggleKeypad={() => patchPrefs({ keypad: !prefs.keypad })}
          onRun={runFromEditor}
          onCursor={(line, column) => setCursor({ line, column })}
          onNotify={notify}
          onStats={setStats}
          onToggleMinimap={() => patchPrefs({ minimap: !prefs.minimap })}
          onSave={saveNow}
          registerView={(view) => {
            editorViewRef.current = view;
          }}
          onSelection={setSelectionLength}
          command={command}
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

      <StatusBar
        fileName={activeFile?.name ?? "—"}
        language={activeFile ? languageLabel(activeFile.name) : "Plain text"}
        cursor={cursor}
        selection={selectionLength}
        stats={stats}
        autoRun={autoRun}
        savedLabel={savedLabel}
        saveError={saveError}
        onOpenProblems={openProblems}
        onGoToLine={goToLine}
        onOpenSettings={() => setSettingsOpen(true)}
      />

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

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        files={project.files.map((file) => ({ id: file.id, name: file.name }))}
        onClose={() => setPaletteOpen(false)}
        onOpenFile={(id) => {
          selectFile(id);
          if (prefs.mobileView === "preview") patchPrefs({ mobileView: "editor" });
        }}
      />

      <PromptSheet
        open={prompt !== null}
        title={prompt?.title ?? ""}
        label={prompt?.label ?? ""}
        value={prompt?.value}
        inputMode={prompt?.inputMode}
        confirmLabel={prompt?.confirmLabel}
        onClose={() => setPrompt(null)}
        onSubmit={(value) => prompt?.onSubmit(value)}
      />

      <Toast toast={toast} />
    </div>
  );
}
