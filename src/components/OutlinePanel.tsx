import { useMemo, useState } from "react";
import type { SymbolEntry } from "../lib/symbols";
import { symbolIcon } from "../lib/symbols";
import type { Diagnostic } from "@codemirror/lint";

export interface OutlineDiagnostic extends Diagnostic {
  line?: number;
}

interface OutlinePanelProps {
  symbols: SymbolEntry[];
  diagnostics: OutlineDiagnostic[];
  currentLine: number;
  onSelectSymbol: (symbol: SymbolEntry) => void;
  onSelectProblem: (diagnostic: OutlineDiagnostic) => void;
  onClose: () => void;
}

type Tab = "outline" | "problems";

export default function OutlinePanel({
  symbols,
  diagnostics,
  currentLine,
  onSelectSymbol,
  onSelectProblem,
  onClose,
}: OutlinePanelProps) {
  const [tab, setTab] = useState<Tab>(diagnostics.length && !symbols.length ? "problems" : "outline");
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query
      ? symbols.filter((symbol) => symbol.name.toLowerCase().includes(query))
      : symbols;
  }, [symbols, filter]);

  return (
    <div className="outline" role="region" aria-label="Outline and problems">
      <div className="outline__head">
        <div className="segmented segmented--sm">
          <button
            type="button"
            className={tab === "outline" ? "is-active" : ""}
            onClick={() => setTab("outline")}
          >
            Outline{filtered.length ? ` ${filtered.length}` : ""}
          </button>
          <button
            type="button"
            className={tab === "problems" ? "is-active" : ""}
            onClick={() => setTab("problems")}
          >
            Problems{diagnostics.length ? ` ${diagnostics.length}` : ""}
          </button>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      {tab === "outline" ? (
        <>
          {symbols.length > 6 ? (
            <input
              className="outline__filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter symbols"
              aria-label="Filter symbols"
            />
          ) : null}
          <ul className="outline__list">
            {filtered.length === 0 ? (
              <li className="outline__empty">
                No symbols yet — functions, classes, CSS rules and headings show up here.
              </li>
            ) : (
              filtered.map((symbol) => (
                <li key={`${symbol.line}-${symbol.name}`}>
                  <button
                    type="button"
                    className={`outline__item ${symbol.line === currentLine ? "is-current" : ""}`}
                    onClick={() => onSelectSymbol(symbol)}
                  >
                    <span className={`outline__icon outline__icon--${symbol.kind}`}>
                      {symbolIcon(symbol.kind)}
                    </span>
                    <span className="outline__name">{symbol.name}</span>
                    <span className="outline__meta">{symbol.detail || symbol.kind}</span>
                    <span className="outline__line">{symbol.line}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <ul className="outline__list">
          {diagnostics.length === 0 ? (
            <li className="outline__empty">No problems found. ✦</li>
          ) : (
            diagnostics.map((diagnostic, index) => (
              <li key={index}>
                <button
                  type="button"
                  className={`outline__item outline__item--${diagnostic.severity} is-${diagnostic.severity}`}
                  onClick={() => onSelectProblem(diagnostic)}
                >
                  <span className="outline__icon">
                    {diagnostic.severity === "error" ? "✕" : diagnostic.severity === "warning" ? "!" : "i"}
                  </span>
                  <span className="outline__name">{diagnostic.message}</span>
                  <span className="outline__line">{diagnostic.line ?? ""}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
