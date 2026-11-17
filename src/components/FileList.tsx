import type { ProjectFile } from "../types";
import { fileBadge } from "../lib/languages";

interface FileListProps {
  files: ProjectFile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  compact?: boolean;
}

export default function FileList({
  files,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onAdd,
  compact = false,
}: FileListProps) {
  return (
    <div className={`file-list ${compact ? "file-list--compact" : ""}`}>
      <ul>
        {files.map((file) => {
          const active = file.id === activeId;
          return (
            <li key={file.id} className={active ? "is-active" : ""}>
              <button
                type="button"
                className="file-list__main"
                onClick={() => onSelect(file.id)}
                aria-current={active ? "true" : undefined}
              >
                <span className={`badge badge--${fileBadge(file.name).toLowerCase()}`}>
                  {fileBadge(file.name)}
                </span>
                <span className="file-list__name">{file.name}</span>
                {active ? <span className="file-list__dot" aria-hidden="true" /> : null}
              </button>
              <div className="file-list__actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Rename"
                  aria-label={`Rename ${file.name}`}
                  onClick={() => onRename(file.id, file.name)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  title="Delete"
                  aria-label={`Delete ${file.name}`}
                  disabled={files.length <= 1}
                  onClick={() => onDelete(file.id)}
                >
                  🗑
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="file-list__add" onClick={onAdd}>
        <span aria-hidden="true">＋</span> New file
      </button>
    </div>
  );
}
