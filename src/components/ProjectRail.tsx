import { useEffect, useState } from "react";
import type { Project } from "../types";

const RAIL_KEY = "otion.ui.rail.v1";

interface ProjectRailProps {
  projects: Project[];
  activeId: string;
  onOpen: (id: string) => void;
  onBrowse: () => void;
}

/**
 * Recent projects, docked as a vertical strip next to the file list. It used to
 * be a horizontal bar that folded the whole workspace into a column, which put
 * the editor and the preview on top of each other — so it is now a real rail
 * that can be collapsed to icons and back.
 */
export default function ProjectRail({ projects, activeId, onOpen, onBrowse }: ProjectRailProps) {
  // Icon-only by default: the file names are the thing you actually read in
  // this column, so the rail earns its width back only when you ask for it.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RAIL_KEY);
      if (stored) setCollapsed(stored === "collapsed");
    } catch {
      /* private mode — keep the default */
    }
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? "collapsed" : "open");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`project-rail ${collapsed ? "is-collapsed" : ""}`}
      aria-label="Recent projects"
      data-rail={collapsed ? "collapsed" : "open"}
    >
      <div className="project-rail__head">
        {collapsed ? null : <span>Projects</span>}
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={toggle}
          aria-label={collapsed ? "Expand project rail" : "Collapse project rail"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand projects" : "Collapse projects"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <div className="project-rail__list">
        {projects.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`project-rail__chip ${entry.id === activeId ? "is-active" : ""}`}
            onClick={() => onOpen(entry.id)}
            aria-current={entry.id === activeId ? "true" : undefined}
            title={`${entry.name} · ${entry.files.length} file${entry.files.length === 1 ? "" : "s"}${
              entry.description ? ` · ${entry.description}` : ""
            }`}
          >
            <span className="project-rail__badge" aria-hidden="true">
              {entry.starred ? "★" : entry.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="project-rail__name">{entry.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="project-rail__chip project-rail__chip--add"
          onClick={onBrowse}
          aria-label={`All projects (${projects.length})`}
          title="All projects (⌘⇧E)"
        >
          <span className="project-rail__badge" aria-hidden="true">
            ▦
          </span>
          <span className="project-rail__name">{projects.length} projects</span>
        </button>
      </div>
    </div>
  );
}
