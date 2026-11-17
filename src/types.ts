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
}

export type ThemeName = "dark" | "light";

export type SyntaxName = "neon" | "classic";

export type MobileView = "editor" | "preview";

export interface UiPrefs {
  theme: ThemeName;
  syntax: SyntaxName;
  fontSize: number;
  wordWrap: boolean;
  mobileView: MobileView;
  keypad: boolean;
}

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug" | "system";

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  text: string;
  time: number;
}
