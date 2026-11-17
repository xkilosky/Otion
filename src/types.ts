export type FileId = string;

export interface ProjectFile {
  id: FileId;
  name: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  /** Free-form note shown in the project switcher. */
  description?: string;
  starred?: boolean;
  /** Template this project was created from, when it came from one. */
  templateId?: string;
  createdAt?: number;
  updatedAt?: number;
  /** File that was open when this project was last used. */
  lastFileId?: string | null;
}

/** Everything the app persists: several projects plus which one is open. */
export interface Workspace {
  version: 2;
  projects: Project[];
  activeProjectId: string | null;
}

export type ThemeName = "dark" | "light";

export type SyntaxName = "neon" | "classic";

/** Phone layout: one pane, a stacked split, or the other pane first. */
export type MobileView = "editor" | "preview" | "split" | "preview-first";

export interface UiPrefs {
  theme: ThemeName;
  syntax: SyntaxName;
  fontSize: number;
  wordWrap: boolean;
  mobileView: MobileView;
  keypad: boolean;
  minimap: boolean;
  /** Editor share of the split, 0.2–0.8. */
  split: number;
  /** Zen mode hides the rail, keypad, console and status bar. */
  zen: boolean;
}

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug" | "system";

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  text: string;
  time: number;
}
