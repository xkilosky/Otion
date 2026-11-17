import { useMemo, useState } from "react";
import Sheet from "./Sheet";
import { templates } from "../lib/templates";
import {
  duplicateProject,
  emptyProject,
  formatBytes,
  projectBytes,
  projectFromTemplateWithMeta,
  sortProjects,
  summariseProject,
} from "../lib/storage";
import { projectInsights } from "../lib/search";
import type { Project } from "../types";

interface ProjectsSheetProps {
  open: boolean;
  projects: Project[];
  activeId: string | null;
  onClose: () => void;
  onOpenProject: (id: string) => void;
  onAddProject: (project: Project) => void;
  onRenameProject: (id: string) => void;
  onEditDetails: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onToggleStar: (id: string) => void;
  onExportProject: (id: string) => void;
  onImport: () => void;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

const relativeTime = (stamp: number) => {
  if (!stamp) return "never";
  const diff = Date.now() - stamp;
  const minute = 60_000;
  if (diff < minute) return "just now";
  if (diff < 60 * minute) return `${Math.round(diff / minute)}m ago`;
  if (diff < 24 * 60 * minute) return `${Math.round(diff / (60 * minute))}h ago`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.round(diff / (24 * 60 * minute))}d ago`;
  return new Date(stamp).toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function ProjectsSheet({
  open,
  projects,
  activeId,
  onClose,
  onOpenProject,
  onAddProject,
  onRenameProject,
  onEditDetails,
  onDeleteProject,
  onDuplicateProject,
  onToggleStar,
  onExportProject,
  onImport,
  onNotify,
}: ProjectsSheetProps) {
  const [tab, setTab] = useState<"projects" | "new">("projects");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "starred">("all");
  const [name, setName] = useState("");

  const list = useMemo(() => {
    const sorted = sortProjects(projects);
    const needle = query.trim().toLowerCase();
    return sorted.filter((project) => {
      if (filter === "starred" && !project.starred) return false;
      if (!needle) return true;
      if (project.name.toLowerCase().includes(needle)) return true;
      if ((project.description ?? "").toLowerCase().includes(needle)) return true;
      return project.files.some((file) => file.name.toLowerCase().includes(needle));
    });
  }, [projects, query, filter]);

  const totalBytes = useMemo(
    () => projects.reduce((total, project) => total + projectBytes(project), 0),
    [projects],
  );

  const create = (project: Project) => {
    if (projects.length >= 24) {
      onNotify("Project limit reached — delete one first", "error");
      return;
    }
    onAddProject(project);
    setTab("projects");
    setName("");
  };

  const createBlank = () => {
    const trimmed = name.trim();
    create(emptyProject(trimmed || `Project ${projects.length + 1}`));
  };

  return (
    <Sheet open={open} title="Projects" onClose={onClose} size="tall">
      <div className="projects__tabs segmented segmented--sm" role="tablist" aria-label="Projects">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "projects"}
          className={tab === "projects" ? "is-active" : ""}
          onClick={() => setTab("projects")}
        >
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "new"}
          className={tab === "new" ? "is-active" : ""}
          onClick={() => setTab("new")}
        >
          ＋ New
        </button>
      </div>

      {tab === "projects" ? (
        <>
          <div className="projects__tools">
            <input
              className="projects__search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects and files"
              aria-label="Search projects"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="button"
              className={`chip ${filter === "starred" ? "is-on" : ""}`}
              onClick={() => setFilter((value) => (value === "starred" ? "all" : "starred"))}
              aria-pressed={filter === "starred"}
            >
              ★ Starred
            </button>
          </div>

          <ul className="project-list">
            {list.length === 0 ? (
              <li className="projects__empty">No projects match “{query}”.</li>
            ) : (
              list.map((project) => {
                const summary = summariseProject(project);
                const insights = projectInsights(project);
                const active = project.id === activeId;
                return (
                  <li key={project.id} className={`project-card ${active ? "is-active" : ""}`}>
                    <div className="project-card__head">
                      <button
                        type="button"
                        className="project-card__open"
                        onClick={() => onOpenProject(project.id)}
                        aria-current={active ? "true" : undefined}
                      >
                        <span className="project-card__title">
                          {project.starred ? <span className="project-card__star">★</span> : null}
                          {project.name}
                        </span>
                        <span className="project-card__meta">
                          {summary.files} file{summary.files === 1 ? "" : "s"} ·{" "}
                          {summary.lines.toLocaleString()} lines · {formatBytes(summary.bytes)} ·{" "}
                          {relativeTime(summary.updatedAt)}
                        </span>
                        {project.description ? (
                          <span className="project-card__desc">{project.description}</span>
                        ) : null}
                        <span className="project-card__tags">
                          {active ? <span className="project-card__tag is-open">open</span> : null}
                          {insights.hasEntry ? <span className="project-card__tag">html</span> : null}
                          {insights.hasCss ? <span className="project-card__tag">css</span> : null}
                          {insights.hasJs ? <span className="project-card__tag">js</span> : null}
                          {insights.todos > 0 ? (
                            <span className="project-card__tag is-todo">{insights.todos} todo</span>
                          ) : null}
                          {insights.emptyFiles > 0 ? (
                            <span className="project-card__tag is-warn">{insights.emptyFiles} empty</span>
                          ) : null}
                        </span>
                      </button>
                      <div className="project-card__actions">
                        <button
                          type="button"
                          className={`icon-btn icon-btn--sm ${project.starred ? "icon-btn--accent" : ""}`}
                          onClick={() => onToggleStar(project.id)}
                          aria-label={project.starred ? `Unstar ${project.name}` : `Star ${project.name}`}
                          title={project.starred ? "Unstar" : "Star"}
                        >
                          {project.starred ? "★" : "☆"}
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => onRenameProject(project.id)}
                          aria-label={`Rename ${project.name}`}
                          title="Rename"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => onEditDetails(project.id)}
                          aria-label={`Edit details for ${project.name}`}
                          title="Description"
                        >
                          ☰
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => {
                            onDuplicateProject(project.id);
                            onNotify(`Duplicated ${project.name}`);
                          }}
                          aria-label={`Duplicate ${project.name}`}
                          title="Duplicate"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          onClick={() => onExportProject(project.id)}
                          aria-label={`Export ${project.name}`}
                          title="Export JSON"
                        >
                          ↧
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm icon-btn--danger"
                          disabled={projects.length <= 1}
                          onClick={() => onDeleteProject(project.id)}
                          aria-label={`Delete ${project.name}`}
                          title={projects.length <= 1 ? "Keep one project" : "Delete"}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <div className="project-card__bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (summary.bytes / Math.max(totalBytes, 1)) * 100)}%` }} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <div className="projects__foot">
            <span>
              {projects.length} of 24 projects · {formatBytes(totalBytes)} stored
            </span>
            <button type="button" className="chip" onClick={onImport}>
              ↥ Import JSON
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Project name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createBlank();
              }}
              placeholder="My new site"
              autoCapitalize="sentences"
            />
          </label>
          <button type="button" className="projects__blank" onClick={createBlank}>
            <span className="projects__blank-icon" aria-hidden="true">
              ＋
            </span>
            <span>
              <strong>Blank project</strong>
              <em>One empty index.html</em>
            </span>
          </button>

          <h3 className="projects__heading">Start from a template</h3>
          <div className="template-grid">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="template-card"
                onClick={() => create(projectFromTemplateWithMeta(template.id))}
              >
                <div
                  className="template-card__art"
                  style={{
                    background: `radial-gradient(120% 120% at 15% 10%, ${template.swatch[0]}, ${template.swatch[1]})`,
                  }}
                >
                  <span className="template-card__files">{template.files().length} files</span>
                </div>
                <div className="template-card__meta">
                  <strong>{template.name}</strong>
                  <span>{template.tagline}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="sheet__lede projects__hint">
            Tip: every project keeps its own files, preferences for the open file and autosave.
            Use ⧉ to fork one before experimenting.
          </p>
        </>
      )}
    </Sheet>
  );
}

/** Re-exported so App can build a duplicate without importing the store twice. */
export { duplicateProject };
