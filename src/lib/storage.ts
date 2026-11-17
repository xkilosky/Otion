import { makeFile, projectFromTemplate, starterProject } from "./templates";
import type { Project, ProjectFile, UiPrefs, Workspace } from "../types";

const LEGACY_PROJECT_KEY = "otion.project.v1";
const WORKSPACE_KEY = "otion.workspace.v2";
const PREFS_KEY = "otion.prefs.v1";
const ACTIVE_KEY = "otion.activeFile.v1";

/** Refuse to grow past this and surface "storage full" instead of throwing. */
export const PROJECT_LIMIT = 24;

const defaultPrefs: UiPrefs = {
  theme: "dark",
  syntax: "neon",
  fontSize: 13.5,
  wordWrap: true,
  mobileView: "editor",
  keypad: true,
  // Wide screens have room for a minimap; phones start with it off.
  minimap: typeof window === "undefined" ? true : window.innerWidth >= 760,
};

export const newProjectId = () =>
  `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const emptyProject = (name = "Untitled project"): Project => ({
  id: newProjectId(),
  name,
  files: [makeFile("index.html", "")],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/* -------------------------------- projects -------------------------------- */

const normaliseProject = (raw: unknown, index: number): Project | null => {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<Project>;
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) return null;
  const files: ProjectFile[] = parsed.files
    .filter((file) => typeof file?.name === "string")
    .map((file, fileIndex) => ({
      id: file.id || `f_${index}_${fileIndex}`,
      name: file.name,
      content: typeof file.content === "string" ? file.content : "",
    }));
  if (files.length === 0) return null;
  return {
    id: parsed.id || `p_restored_${index}`,
    name: parsed.name || "Untitled project",
    files,
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    starred: parsed.starred === true,
    templateId: typeof parsed.templateId === "string" ? parsed.templateId : undefined,
    createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    lastFileId: typeof parsed.lastFileId === "string" ? parsed.lastFileId : null,
  };
};

/** v1 stored a single project under its own key — fold it into the new shape. */
function loadLegacyProject(): Project | null {
  try {
    const raw = localStorage.getItem(LEGACY_PROJECT_KEY);
    if (!raw) return null;
    const project = normaliseProject(JSON.parse(raw), 0);
    localStorage.removeItem(LEGACY_PROJECT_KEY);
    return project;
  } catch {
    return null;
  }
}

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Workspace>;
      const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
        .map(normaliseProject)
        .filter((project): project is Project => project !== null);
      if (projects.length) {
        const activeProjectId =
          projects.find((project) => project.id === parsed.activeProjectId)?.id ??
          projects[0].id;
        return { version: 2, projects, activeProjectId };
      }
    }
  } catch {
    /* fall through to a fresh workspace */
  }

  const legacy = loadLegacyProject();
  const first = legacy ?? starterProject();
  return { version: 2, projects: [first], activeProjectId: first.id };
}

export function saveWorkspace(workspace: Workspace) {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------- prefs ---------------------------------- */

export function loadPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      theme: parsed.theme === "light" ? "light" : "dark",
      syntax: parsed.syntax === "classic" ? "classic" : "neon",
      fontSize:
        typeof parsed.fontSize === "number" && parsed.fontSize >= 10 && parsed.fontSize <= 24
          ? parsed.fontSize
          : defaultPrefs.fontSize,
      wordWrap: parsed.wordWrap !== false,
      mobileView: parsed.mobileView === "preview" ? "preview" : "editor",
      keypad: parsed.keypad !== false,
      minimap: typeof parsed.minimap === "boolean" ? parsed.minimap : defaultPrefs.minimap,
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(prefs: UiPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

/* ------------------------------- active file ------------------------------ */

export function loadActiveFileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveFileId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------- helpers --------------------------------- */

/** Rough byte size of a project, for the storage meter in the switcher. */
export function projectBytes(project: Project): number {
  try {
    return new Blob([JSON.stringify(project)]).size;
  } catch {
    return JSON.stringify(project).length;
  }
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Sorted for display: starred first, then most recently touched. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (Boolean(a.starred) !== Boolean(b.starred)) return a.starred ? -1 : 1;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

export function summariseProject(project: Project) {
  const lines = project.files.reduce(
    (total, file) => total + (file.content ? file.content.split("\n").length : 0),
    0,
  );
  return {
    files: project.files.length,
    lines,
    bytes: projectBytes(project),
    updatedAt: project.updatedAt ?? 0,
  };
}

/** Build a project from a template id, carrying its metadata. */
export function projectFromTemplateWithMeta(templateId: string): Project {
  const base = projectFromTemplate(templateId);
  return {
    ...base,
    templateId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastFileId: base.files[0]?.id ?? null,
  };
}

/** Deep-enough duplicate: new file ids, same content. */
export function duplicateProject(project: Project): Project {
  return {
    id: newProjectId(),
    name: `${project.name} copy`,
    description: project.description,
    templateId: project.templateId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastFileId: null,
    files: project.files.map((file) => makeFile(file.name, file.content)),
  };
}
