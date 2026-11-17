interface SplitRatioProps {
  /** Editor share of a stacked (phone) split, 0–1. */
  value: number;
  onChange: (next: number) => void;
  /** "code" when the editor is on top, "preview" when it is below. */
  first: "code" | "preview";
}

/**
 * The phone ratio slider used to sit in the header next to six other buttons
 * and push them into each other. It now rides on the divider between the two
 * panes, where the drag would happen anyway — and only while a stacked split
 * is actually on screen.
 */
export default function SplitRatio({ value, onChange, first }: SplitRatioProps) {
  return (
    <label className="split-ratio" title="Drag to resize both panes">
      <span className="visually-hidden">Editor height share</span>
      <span className="split-ratio__end" aria-hidden="true">
        {first === "code" ? "Code" : "Preview"}
      </span>
      <input
        type="range"
        min={22}
        max={78}
        step={2}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        aria-label="Editor height share"
      />
      <span className="split-ratio__value">{Math.round(value * 100)}%</span>
      <span className="split-ratio__end" aria-hidden="true">
        {first === "code" ? "Preview" : "Code"}
      </span>
    </label>
  );
}
