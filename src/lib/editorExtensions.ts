import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { linter, lintGutter } from "@codemirror/lint";
import { linterForFile } from "./diagnostics";
import { expandAbbreviation, abbreviationBefore } from "./emmet";

/**
 * Mindful defaults shared by every Otion editor instance: live linting, a Tab
 * key that either expands an Emmet abbreviation or indents, and a subtle
 * placeholder for empty files.
 */
export function lintingFor(fileName: string) {
  const linterFn = linterForFile(fileName);
  if (!linterFn) return [];
  return [
    linter((view) => linterFn(view.state), { delay: 400 }),
    lintGutter(),
  ];
}

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/**
 * Tab behaviour, in order of preference:
 *  1. expand the Emmet abbreviation before the caret (HTML/SVG only)
 *  2. accept the open completion popup
 *  3. fall back to indentation (inserting spaces inside the selection)
 */
export function smartIndentKeymap(fileName: string): Extension {
  const isMarkup = ["html", "htm", "svg"].includes(extensionOf(fileName));

  return keymap.of([
    {
      key: "Tab",
      preventDefault: true,
      run: (view) => {
        const popupOpen = document.querySelector(".cm-tooltip-autocomplete");
        if (popupOpen) return false;

        if (isMarkup) {
          const head = view.state.selection.main.head;
          const line = view.state.doc.lineAt(head);
          const before = view.state.sliceDoc(line.from, head);
          const abbreviation = abbreviationBefore(before);
          if (abbreviation && /[>+#.*[\]{]/.test(abbreviation)) {
            const expanded = expandAbbreviation(abbreviation);
            if (expanded) {
              const from = head - abbreviation.length;
              const headTarget = from + expanded.indexOf("></");
              view.dispatch({
                changes: { from, to: head, insert: expanded },
                selection: {
                  anchor: headTarget > from ? headTarget + 1 : from + expanded.length,
                },
                scrollIntoView: true,
              });
              return true;
            }
          }
        }
        return false;
      },
    },
    indentWithTab,
  ]);
}

export function emptyFilePlaceholder(fileName: string) {
  const hint =
    extensionOf(fileName) === "html"
      ? "Start typing — try `div.card` then Tab to expand, or `!` for a full page."
      : extensionOf(fileName) === "css"
        ? "Try `flexcenter` + Tab for a centered flexbox."
        : extensionOf(fileName) === "js" || extensionOf(fileName) === "jsx"
          ? "Try `log` + Tab for console.log()."
          : "Start typing…";
  return placeholderExt(hint);
}

export const editorSizing = EditorView.theme({
  ".cm-content": { minHeight: "100%" },
});
