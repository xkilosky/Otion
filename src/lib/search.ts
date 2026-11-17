import type { Project, ProjectFile } from "../types";

export interface SearchMatch {
  fileId: string;
  fileName: string;
  line: number;
  column: number;
  preview: string;
  /** Index of the match inside `preview`, for highlighting. */
  index: number;
  length: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  limit?: number;
}

/**
 * Search every file in the project. Regex mode is guarded: an invalid pattern
 * throws inside here and comes back as an `error` string rather than crashing
 * the panel.
 */
export function searchProject(
  project: Project,
  query: string,
  options: SearchOptions = {},
): { matches: SearchMatch[]; error: string | null; truncated: boolean } {
  const { caseSensitive = false, regex = false, wholeWord = false, limit = 500 } = options;
  const trimmed = query.trim();
  if (!trimmed) return { matches: [], error: null, truncated: false };

  let matcher: RegExp;
  try {
    const body = regex
      ? trimmed
      : trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrapped = wholeWord ? `\\b(?:${body})\\b` : body;
    matcher = new RegExp(wrapped, caseSensitive ? "g" : "gi");
  } catch (error) {
    return {
      matches: [],
      error: error instanceof Error ? error.message : "Invalid pattern",
      truncated: false,
    };
  }

  const matches: SearchMatch[] = [];
  let truncated = false;

  for (const file of project.files) {
    const lines = file.content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index];
      matcher.lastIndex = 0;
      let found = matcher.exec(text);
      while (found) {
        if (matches.length >= limit) {
          truncated = true;
          break;
        }
        // Empty matches (e.g. `a*`) would loop forever.
        if (found[0].length === 0) break;
        const start = Math.max(0, found.index - 24);
        const preview = (start > 0 ? "…" : "") + text.slice(start, start + 96).trimEnd();
        matches.push({
          fileId: file.id,
          fileName: file.name,
          line: index + 1,
          column: found.index + 1,
          preview,
          index: (start > 0 ? 1 : 0) + Math.max(0, found.index - start),
          length: found[0].length,
        });
        found = matcher.exec(text);
      }
      if (truncated) break;
    }
    if (truncated) break;
  }

  return { matches, error: null, truncated };
}

/** Group matches by file, preserving document order. */
export function groupMatches(matches: SearchMatch[]) {
  const groups = new Map<string, { fileId: string; fileName: string; matches: SearchMatch[] }>();
  for (const match of matches) {
    const existing = groups.get(match.fileId);
    if (existing) existing.matches.push(match);
    else groups.set(match.fileId, { fileId: match.fileId, fileName: match.fileName, matches: [match] });
  }
  return [...groups.values()];
}

export function replaceInFile(
  file: ProjectFile,
  query: string,
  replacement: string,
  options: SearchOptions = {},
): { content: string; count: number; error: string | null } {
  const result = searchProject({ id: "x", name: "x", files: [file] }, query, options);
  if (result.error) return { content: file.content, count: 0, error: result.error };
  if (!result.matches.length) return { content: file.content, count: 0, error: null };

  const flags = options.caseSensitive ? "g" : "gi";
  const body = options.regex
    ? query.trim()
    : query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(options.wholeWord ? `\\b(?:${body})\\b` : body, flags);
  return {
    content: file.content.replace(pattern, replacement),
    count: result.matches.length,
    error: null,
  };
}

/** Quick project health summary for the switcher card. */
export function projectInsights(project: Project) {
  const html = project.files.find((file) => /\.html?$/i.test(file.name));
  const hasCss = project.files.some((file) => /\.css$/i.test(file.name));
  const hasJs = project.files.some((file) => /\.(m?js|cjs|jsx|ts|tsx)$/i.test(file.name));
  const totalLines = project.files.reduce((total, file) => total + file.content.split("\n").length, 0);
  const todos = project.files.reduce(
    (total, file) => total + (file.content.match(/\b(TODO|FIXME)\b/g)?.length ?? 0),
    0,
  );
  return {
    hasEntry: Boolean(html),
    hasCss,
    hasJs,
    totalLines,
    todos,
    emptyFiles: project.files.filter((file) => !file.content.trim()).length,
  };
}
