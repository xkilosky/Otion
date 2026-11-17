import Sheet from "./Sheet";
import { templates } from "../lib/templates";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (templateId: string) => void;
}

export default function TemplatePicker({ open, onClose, onPick }: TemplatePickerProps) {
  return (
    <Sheet open={open} title="New project" onClose={onClose} size="tall">
      <p className="sheet__lede">
        Start from a template, or keep building on what you have — your current files are
        replaced only after you pick.
      </p>
      <div className="template-grid">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="template-card"
            onClick={() => onPick(template.id)}
          >
            <div
              className="template-card__art"
              style={{
                background: `radial-gradient(120% 120% at 15% 10%, ${template.swatch[0]}, ${template.swatch[1]})`,
              }}
            >
              <span className="template-card__files">
                {template.files().length} files
              </span>
            </div>
            <div className="template-card__meta">
              <strong>{template.name}</strong>
              <span>{template.tagline}</span>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
