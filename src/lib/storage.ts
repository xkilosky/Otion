import { starterProject } from "./templates";
import type { Project, UiPrefs } from "../types";

const PROJECT_KEY = "otion.project.v1";
const PREFS_KEY = "otion.prefs.v1";
const ACTIVE_KEY = "otion.activeFile.v1";

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

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return starterProject();
    const parsed = JSON.parse(raw) as Project;
    if (!parsed?.files?.length) return starterProject();
    return {
      id: parsed.id || "p_restored",
      name: parsed.name || "Untitled workspace",
      files: parsed.files
        .filter((file) => typeof file.name === "string")
        .map((file, index) => ({
          id: file.id || `f_${index}`,
          name: file.name,
          content: typeof file.content === "string" ? file.content : "",
        })),
    };
  } catch {
    return starterProject();
  }
}

export function saveProject(project: Project) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

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
