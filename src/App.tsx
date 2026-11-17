import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import ProjectsSheet from "./components/ProjectsSheet";
import SearchPanel from "./components/SearchPanel";
import Splitter from "./components/Splitter";
import type { EditorStats } from "./components/CodeEditor";
import {
  duplicateProject,
  emptyProject,
  loadActiveFileId,
  loadPrefs,
  loadWorkspace,
  newProjectId,
  saveActiveFileId,
  savePrefs,
  saveWorkspace,
  clampSplit,
  projectFromTemplateWithMeta,
  sortProjects,
} from "./lib/storage";
import { makeFile } from "./lib/templates";
import { formatCode } from "./lib/format";
import type { EditorView } from "@codemirror/view";
import { languageLabel } from "./lib/languages";
import type { ConsoleEntry, Project, UiPrefs, Workspace } from "./types";

const CONSOLE_LIMIT = 300;
const QUICK_NAMES = ["index.html", "styles.css", "script.js", "README.md"];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A command without its auto-assigned nonce. */
type EditorCommandInput = DistributiveOmit<EditorCommand, "nonce">;

let entrySeq = 0;

const newChannel = () => `otion-${Math.random().toString(36).slice(2, 10)}`;

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace());
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
  const [confirm, setConfirm] = useState<
    | null
    | {
        title: string;
        body: string;
        confirmLabel: string;
        danger?: boolean;
        run: () => void;
      }
  >(null);
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
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { toast, notify } = useToast();
  const channelRef = useRef(channel);
  const saveTimer = useRef<number | null>(null);

  const project = useMemo<Project>(() => {
    return (
      workspace.projects.find((entry) => entry.id === workspace.activeProjectId) ??
      workspace.projects[0] ??
      emptyProject()
    );
  }, [workspace]);

  /** Replace the open project, keeping the workspace list in sync. */
  const setProject = useCallback(
    (patch: Project | ((current: Project) => Project)) => {
      setWorkspace((current) => {
        const target =
          current.projects.find((entry) => entry.id === current.activeProjectId) ??
          current.projects[0];
        if (!target) return current;
        const next =
          typeof patch === "function" ? (patch as (value: Project) => Project)(target) : patch;
        return {
          ...current,
          projects: current.projects.map((entry) =>
            entry.id === target.id ? { ...next, id: target.id, updatedAt: Date.now() } : entry,
          ),
        };
      });
    },
    [],
  );

  const activeFile = useMemo(
    () =>
      project.files.find((file) => file.id === activeFileId) ??
      project.files[0] ??
      null,
    [project.files, activeFileId],
  );

  // Restore the file that was open: the project remembers its own last file,
  // and the session-level key covers the very first mount.
  useEffect(() => {
    const remembered = project.lastFileId ?? loadActiveFileId();
    if (remembered && project.files.some((file) => file.id === remembered)) {
      setActiveFileId(remembered);
    } else {
      setActiveFileId(project.files[0]?.id ?? null);
    }
    // Re-runs whenever the open project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

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
      const ok = saveWorkspace(workspace);
      setSaveError(!ok);
      if (ok) setSavedAt(Date.now());
    }, 450);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [workspace]);

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

  const setSplit = useCallback((next: number) => {
    setPrefs((current) => ({ ...current, split: clampSplit(next) }));
  }, []);

  const toggleZen = useCallback(() => {
    setPrefs((current) => {
      const zen = !current.zen;
      notify(zen ? "Zen mode — ⌘⇧Z to exit" : "Zen mode off");
      return { ...current, zen };
    });
  }, [notify]);

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

  const renameFile = useCallback(
    (id: string, currentName: string) => {
      setPrompt({
        title: "Rename file",
        label: "File name",
        value: currentName,
        confirmLabel: "Rename",
        onSubmit: (name) => {
          const clean = name.replace(/\s+/g, "-");
          if (project.files.some((file) => file.id !== id && file.name.toLowerCase() === clean.toLowerCase())) {
            notify(`"${clean}" already exists`, "error");
            return;
          }
          setProject((current) => ({
            ...current,
            files: current.files.map((file) =>
              file.id === id ? { ...file, name: clean } : file,
            ),
          }));
          notify(`Renamed to ${clean}`);
        },
      });
    },
    [project.files, notify, setProject],
  );

  const deleteFile = useCallback(
    (id: string) => {
      if (project.files.length <= 1) {
        notify("Keep at least one file", "error");
        return;
      }
      const target = project.files.find((file) => file.id === id);
      if (!target) return;
      const remaining = project.files.filter((file) => file.id !== id);
      setConfirm({
        title: "Delete file",
        body: `Delete “${target.name}”? This can't be undone.`,
        confirmLabel: "Delete",
        danger: true,
        run: () => {
          setProject((current) => ({ ...current, files: remaining }));
          setActiveFileId((current) => (current === id ? (remaining[0]?.id ?? null) : current));
          notify("File deleted");
        },
      });
    },
    [project.files, notify, setProject],
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

  const addProject = useCallback(
    (next: Project) => {
      setWorkspace((current) => ({
        version: 2,
        projects: [...current.projects, next],
        activeProjectId: next.id,
      }));
      setActiveFileId(next.files[0]?.id ?? null);
      setEntries([]);
      setConsoleOpen(false);
      setTemplatesOpen(false);
      setProjectsOpen(false);
      setChannel(newChannel());
      return next;
    },
    [],
  );

  const loadTemplate = useCallback(
    (templateId: string) => {
      // A template always becomes its own project, so nothing is overwritten.
      const next = addProject(projectFromTemplateWithMeta(templateId));
      notify(`${next.name} created`);
    },
    [addProject, notify],
  );

  const openProject = useCallback(
    (id: string) => {
      setWorkspace((current) => {
        if (!current.projects.some((entry) => entry.id === id)) return current;
        return { ...current, activeProjectId: id };
      });
      setActiveFileId(null);
      setEntries([]);
      setConsoleOpen(false);
      setProjectsOpen(false);
      setChannel(newChannel());
    },
    [],
  );

  const renameProjectById = useCallback(
    (id: string) => {
      const target = workspace.projects.find((entry) => entry.id === id);
      if (!target) return;
      setPrompt({
        title: "Rename project",
        label: "Project name",
        value: target.name,
        confirmLabel: "Rename",
        onSubmit: (name) =>
          setWorkspace((current) => ({
            ...current,
            projects: current.projects.map((entry) =>
              entry.id === id ? { ...entry, name, updatedAt: Date.now() } : entry,
            ),
          })),
      });
    },
    [workspace.projects],
  );

  const describeProject = useCallback(
    (id: string) => {
      const target = workspace.projects.find((entry) => entry.id === id);
      if (!target) return;
      setPrompt({
        title: "Project description",
        label: "Short note",
        value: target.description ?? "",
        confirmLabel: "Save",
        onSubmit: (description) =>
          setWorkspace((current) => ({
            ...current,
            projects: current.projects.map((entry) =>
              entry.id === id ? { ...entry, description, updatedAt: Date.now() } : entry,
            ),
          })),
      });
    },
    [workspace.projects],
  );

  const deleteProject = useCallback(
    (id: string) => {
      if (workspace.projects.length <= 1) {
        notify("Keep at least one project", "error");
        return;
      }
      const target = workspace.projects.find((entry) => entry.id === id);
      if (!target) return;
      setConfirm({
        title: "Delete project",
        body: `Delete “${target.name}” and its ${target.files.length} file${
          target.files.length === 1 ? "" : "s"
        }? This can't be undone.`,
        confirmLabel: "Delete project",
        danger: true,
        run: () => {
          setWorkspace((current) => {
            const projects = current.projects.filter((entry) => entry.id !== id);
            return {
              ...current,
              projects,
              activeProjectId:
                current.activeProjectId === id ? projects[0].id : current.activeProjectId,
            };
          });
          setActiveFileId(null);
          setChannel(newChannel());
          notify("Project deleted");
        },
      });
    },
    [workspace.projects, notify],
  );

  const duplicateProjectById = useCallback((id: string) => {
    setWorkspace((current) => {
      const target = current.projects.find((entry) => entry.id === id);
      if (!target) return current;
      const copy = duplicateProject(target);
      return { ...current, projects: [...current.projects, copy], activeProjectId: copy.id };
    });
    setActiveFileId(null);
    setChannel(newChannel());
  }, []);

  const toggleStar = useCallback((id: string) => {
    setWorkspace((current) => ({
      ...current,
      projects: current.projects.map((entry) =>
        entry.id === id ? { ...entry, starred: !entry.starred } : entry,
      ),
    }));
  }, []);

  const downloadJson = useCallback((payload: unknown, name: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "otion-project"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportProject = useCallback(() => {
    downloadJson(
      {
        app: "Otion",
        version: 2,
        exportedAt: new Date().toISOString(),
        id: project.id,
        name: project.name,
        description: project.description,
        files: project.files.map(({ name, content }) => ({ name, content })),
      },
      project.name,
    );
    notify("Project exported");
  }, [downloadJson, project, notify]);

  const exportProjectById = useCallback(
    (id: string) => {
      const target = workspace.projects.find((entry) => entry.id === id);
      if (!target) return;
      downloadJson(
        {
          app: "Otion",
          version: 2,
          exportedAt: new Date().toISOString(),
          id: target.id,
          name: target.name,
          description: target.description,
          files: target.files.map(({ name, content }) => ({ name, content })),
        },
        target.name,
      );
      notify(`Exported ${target.name}`);
    },
    [downloadJson, workspace.projects, notify],
  );

  const exportEverything = useCallback(() => {
    downloadJson(
      {
        app: "Otion",
        version: 2,
        kind: "workspace",
        exportedAt: new Date().toISOString(),
        projects: workspace.projects.map((entry) => ({
          name: entry.name,
          description: entry.description,
          starred: entry.starred,
          files: entry.files.map(({ name, content }) => ({ name, content })),
        })),
      },
      "otion-workspace",
    );
    notify(`Exported ${workspace.projects.length} projects`);
  }, [downloadJson, workspace.projects, notify]);

  const importProject = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json) as
          | (Partial<Project> & { projects?: Partial<Project>[] })
          | Partial<Project>[];
        const sources: Partial<Project>[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as { projects?: Partial<Project>[] }).projects)
            ? (parsed as { projects: Partial<Project>[] }).projects
            : [parsed as Partial<Project>];

        const imported: Project[] = [];
        for (const source of sources) {
          if (!Array.isArray(source.files) || source.files.length === 0) continue;
          imported.push({
            id: newProjectId(),
            name: source.name || "Imported project",
            description: source.description,
            starred: source.starred === true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastFileId: null,
            files: source.files.map((file, index) =>
              makeFile(
                file.name || `file${index + 1}.txt`,
                typeof file.content === "string" ? file.content : "",
              ),
            ),
          });
        }
        if (!imported.length) throw new Error("No files in project");

        setWorkspace((current) => ({
          version: 2,
          projects: [...current.projects, ...imported],
          activeProjectId: imported[0].id,
        }));
        setActiveFileId(imported[0].files[0]?.id ?? null);
        setSettingsOpen(false);
        setProjectsOpen(false);
        setChannel(newChannel());
        notify(
          imported.length === 1
            ? `Imported ${imported[0].name}`
            : `Imported ${imported.length} projects`,
        );
      } catch {
        notify("That file isn't an Otion project", "error");
      }
    },
    [notify],
  );

  const importProjectFromDisk = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      importProject(await file.text());
    };
    input.click();
  }, [importProject]);

  const resetWorkspace = useCallback(() => {
    setConfirm({
      title: "Reset project",
      body: `Replace every file in “${project.name}” with a fresh starter project?`,
      confirmLabel: "Reset project",
      danger: true,
      run: () => {
        const fresh = projectFromTemplateWithMeta("blank");
        setWorkspace((current) => ({
          ...current,
          projects: current.projects.map((entry) =>
            entry.id === project.id ? { ...fresh, id: entry.id, name: entry.name } : entry,
          ),
        }));
        setActiveFileId(null);
        setEntries([]);
        setSettingsOpen(false);
        setChannel(newChannel());
        notify("Project reset");
      },
    });
  }, [project.id, project.name, notify]);

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
    const ok = saveWorkspace(workspace);
    setSaveError(!ok);
    if (ok) setSavedAt(Date.now());
    notify(ok ? "Saved locally" : "Storage full — export instead", ok ? "info" : "error");
    return ok;
  }, [workspace, notify]);

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
      } else if (key === "e" && event.shiftKey) {
        event.preventDefault();
        setProjectsOpen(true);
      } else if (key === "z" && event.shiftKey) {
        event.preventDefault();
        setPrefs((current) => ({ ...current, zen: !current.zen }));
      } else if (key === "h" && event.shiftKey) {
        event.preventDefault();
        if (prefs.mobileView === "preview") patchPrefs({ mobileView: "editor" });
        setSearchOpen(true);
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
        id: "projects",
        label: "Switch project…",
        group: "Projects",
        keys: "⌘⇧E",
        run: () => setProjectsOpen(true),
      },
      {
        id: "new-project",
        label: "New blank project",
        group: "Projects",
        run: () => {
          const next = emptyProject(`Project ${workspace.projects.length + 1}`);
          addProject(next);
          notify(`Created ${next.name}`);
        },
      },
      {
        id: "duplicate-project",
        label: `Duplicate “${project.name}”`,
        group: "Projects",
        run: () => {
          duplicateProjectById(project.id);
          notify("Project duplicated");
        },
      },
      {
        id: "star-project",
        label: project.starred ? "Unstar this project" : "Star this project",
        group: "Projects",
        run: () => toggleStar(project.id),
      },
      {
        id: "search-project",
        label: "Search in project…",
        group: "Editor",
        keys: "⌘⇧H",
        run: () => setSearchOpen(true),
      },
      {
        id: "export-all",
        label: `Export all ${workspace.projects.length} projects`,
        group: "File",
        run: exportEverything,
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
        id: "zen",
        label: prefs.zen ? "Exit zen mode" : "Zen mode",
        group: "View",
        keys: "⌘⇧Z",
        run: toggleZen,
      },
      {
        id: "split-even",
        label: "Split view 50 / 50",
        group: "View",
        run: () => setSplit(0.5),
      },
      {
        id: "split-editor",
        label: "Give the editor more room",
        group: "View",
        run: () => setSplit(0.68),
      },
      {
        id: "split-preview",
        label: "Give the preview more room",
        group: "View",
        run: () => setSplit(0.34),
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
      ...sortProjects(workspace.projects)
        .filter((entry) => entry.id !== project.id)
        .slice(0, 12)
        .map<Command>((entry) => ({
          id: `open-project:${entry.id}`,
          label: entry.name,
          group: "Open project",
          hint: `${entry.files.length} file${entry.files.length === 1 ? "" : "s"}`,
          run: () => openProject(entry.id),
        })),
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
    addProject,
    autoRun,
    consoleOpen,
    dispatchCommand,
    duplicateProjectById,
    emptyProject,
    exportEverything,
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
    prefs.zen,
    prefs.syntax,
    prefs.theme,
    prefs.wordWrap,
    project.id,
    project.name,
    project.starred,
    renameProject,
    runPreview,
    saveNow,
    setSplit,
    toggleAutoRun,
    toggleZen,
    toggleStar,
    workspace.projects.length,
    notify,
    openProject,
    workspace.projects,
  ]);

  return (
    <div
      className={`app app--${prefs.theme} view-${prefs.mobileView} ${prefs.zen ? "app--zen" : ""}`}
      style={{ "--split": `${Math.round(clampSplit(prefs.split) * 100)}%` } as CSSProperties}
    >
      <TopBar
        projectName={project.name}
        projectCount={workspace.projects.length}
        onRenameProject={renameProject}
        onOpenProjects={() => setProjectsOpen(true)}
        onSearch={() => {
          if (prefs.mobileView === "preview") patchPrefs({ mobileView: "editor" });
          setSearchOpen(true);
        }}
        mobileView={prefs.mobileView}
        onMobileView={(view) => patchPrefs({ mobileView: view })}
        autoRun={autoRun}
        onToggleAutoRun={toggleAutoRun}
        onOpenFiles={() => setFilesOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleZen={toggleZen}
        zen={prefs.zen}
      />

      <main
        className="workspace"
        data-view={prefs.mobileView}
        data-console={consoleOpen ? "open" : "closed"}
      >
        <aside className="sidebar" aria-label="Project files">
          <button
            type="button"
            className="sidebar__project"
            onClick={() => setProjectsOpen(true)}
            title="Switch project (⌘⇧E)"
          >
            <span className="sidebar__project-dot" aria-hidden="true" />
            <span className="sidebar__project-name">{project.name}</span>
            <span className="sidebar__project-count">{workspace.projects.length}</span>
            <span aria-hidden="true">⇄</span>
          </button>
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

        {prefs.zen ? null : (
          <div className="project-rail" aria-label="Recent projects">
            {sortProjects(workspace.projects)
              .slice(0, 6)
              .map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`project-rail__chip ${entry.id === project.id ? "is-active" : ""}`}
                  onClick={() => openProject(entry.id)}
                  title={`${entry.files.length} file${entry.files.length === 1 ? "" : "s"} · ${
                    entry.description || "open project"
                  }`}
                >
                  {entry.starred ? <span className="project-rail__star">★</span> : null}
                  <span className="project-rail__name">{entry.name}</span>
                </button>
              ))}
            <button
              type="button"
              className="project-rail__chip project-rail__chip--add"
              onClick={() => setProjectsOpen(true)}
              aria-label="All projects"
            >
              ▦ {workspace.projects.length}
            </button>
          </div>
        )}

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

        <Splitter value={clampSplit(prefs.split)} onChange={setSplit} onCommit={setSplit} />

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

      {searchOpen ? (
        <SearchPanel
          project={project}
          onJump={(fileId, line, column) => {
            selectFile(fileId);
            setSearchOpen(false);
            dispatchCommand({ kind: "goToLine", line });
            void column;
          }}
          onApplyReplaceAll={(changes) => {
            setProject((current) => ({
              ...current,
              files: current.files.map((file) => {
                const change = changes.find((entry) => entry.fileId === file.id);
                return change ? { ...file, content: change.content } : file;
              }),
            }));
            notify(`Replaced in ${changes.length} file${changes.length === 1 ? "" : "s"}`);
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

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
        onOpenProjects={() => {
          setSettingsOpen(false);
          setProjectsOpen(true);
        }}
        onExportAll={exportEverything}
        projectCount={workspace.projects.length}
        onNotify={notify}
      />

      <ProjectsSheet
        open={projectsOpen}
        projects={workspace.projects}
        activeId={project.id}
        onClose={() => setProjectsOpen(false)}
        onOpenProject={openProject}
        onAddProject={(next) => {
          addProject(next);
          notify(`Created ${next.name}`);
        }}
        onRenameProject={renameProjectById}
        onEditDetails={describeProject}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProjectById}
        onToggleStar={toggleStar}
        onExportProject={exportProjectById}
        onImport={() =>
          importProjectFromDisk()
        }
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

      <Sheet
        open={confirm !== null}
        title={confirm?.title ?? ""}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${confirm?.danger ? "btn--danger" : "btn--primary"}`}
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              {confirm?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        <p className="sheet__lede">{confirm?.body}</p>
      </Sheet>

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
