import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { languageForFile, lazyLanguageForFile } from "../lib/languages";
import { editorTheme, type SyntaxPreset } from "../lib/editorTheme";

export interface EditorHandle {
  insert: (text: string) => void;
  moveHorizontal: (direction: -1 | 1) => void;
  indent: () => void;
  focus: () => void;
  remeasure: () => void;
  selectedText: () => string;
}

interface CodeEditorProps {
  fileName: string;
  value: string;
  theme: "dark" | "light";
  syntax: SyntaxPreset;
  fontSize: number;
  wordWrap: boolean;
  onChange: (value: string) => void;
  onFormat: () => void;
  onCursor?: (line: number, column: number) => void;
}

const CodeEditor = forwardRef<EditorHandle, CodeEditorProps>(function CodeEditor(
  { fileName, value, theme, syntax, fontSize, wordWrap, onChange, onFormat, onCursor },
  ref,
) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const languageConf = useRef(new Compartment());
  const themeConf = useRef(new Compartment());
  const wrapConf = useRef(new Compartment());

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;
  const onFormatRef = useRef(onFormat);
  onFormatRef.current = onFormat;

  // Build the view once per file mount.
  useEffect(() => {
    if (!host.current) return;

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({
        markerDOM: (open) => {
          const span = document.createElement("span");
          span.textContent = open ? "▾" : "▸";
          span.className = "otion-fold";
          return span;
        },
      }),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of("  "),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ activateOnTyping: true, maxRenderedOptions: 60 }),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      EditorView.contentAttributes.of({
        autocapitalize: "off",
        autocorrect: "off",
        spellcheck: "false",
        "aria-label": "Code editor",
      }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      keymap.of([
        {
          key: "Mod-Shift-f",
          preventDefault: true,
          run: () => {
            onFormatRef.current();
            return true;
          },
        },
      ]),
      languageConf.current.of(languageForFile(fileName) ?? []),
      themeConf.current.of(editorTheme(theme, syntax)),
      wrapConf.current.of(wordWrap ? EditorView.lineWrapping : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          onCursorRef.current?.(line.number, head - line.from + 1);
        }
      }),
    ];

    const state = EditorState.create({ doc: value, extensions });
    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;

    let disposed = false;
    void lazyLanguageForFile(fileName).then((language) => {
      // `null` means this file type has no lazily-loaded grammar: keep whatever
      // languageForFile() already installed (an empty array here would strip it).
      if (disposed || language === null) return;
      instance.dispatch({ effects: languageConf.current.reconfigure(language) });
    });

    return () => {
      disposed = true;
      instance.destroy();
      view.current = null;
    };
    // File identity drives a fresh document; content changes flow through the
    // separate effect below so typing never rebuilds the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName]);

  // External value sync (e.g. template load, file switch by same name).
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const current = instance.state.doc.toString();
    if (current !== value) {
      instance.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: languageConf.current.reconfigure(languageForFile(fileName) ?? []),
    });
  }, [fileName]);

  useEffect(() => {
    view.current?.dispatch({
      effects: themeConf.current.reconfigure(editorTheme(theme, syntax)),
    });
  }, [theme, syntax]);

  useEffect(() => {
    view.current?.dispatch({
      effects: wrapConf.current.reconfigure(
        wordWrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [wordWrap]);

  useImperativeHandle(
    ref,
    (): EditorHandle => ({
      insert(text) {
        const instance = view.current;
        if (!instance) return;
        const { from, to } = instance.state.selection.main;
        if (text === "__LEFT__") {
          instance.dispatch({ selection: { anchor: Math.max(0, from - 1) } });
          instance.focus();
          return;
        }
        if (text === "__RIGHT__") {
          instance.dispatch({ selection: { anchor: to + 1 } });
          instance.focus();
          return;
        }
        if (text === "__TAB__") {
          instance.dispatch(instance.state.replaceSelection("  "));
          instance.focus();
          return;
        }
        instance.dispatch(instance.state.replaceSelection(text));
        // Place the caret before the first closing bracket on the same insert.
        const caret = instance.state.selection.main.head;
        const closing = text.search(/[)\]}>]/);
        if (closing > 0) {
          instance.dispatch({ selection: { anchor: caret - (text.length - closing) } });
        }
        instance.focus();
      },
      moveHorizontal(direction) {
        const instance = view.current;
        if (!instance) return;
        const head = instance.state.selection.main.head;
        const target =
          direction === -1 ? Math.max(0, head - 1) : Math.min(instance.state.doc.length, head + 1);
        instance.dispatch({ selection: { anchor: target } });
        instance.focus();
      },
      indent() {
        const instance = view.current;
        if (!instance) return;
        instance.dispatch(instance.state.replaceSelection("  "));
        instance.focus();
      },
      focus() {
        view.current?.focus();
      },
      remeasure() {
        view.current?.requestMeasure();
      },
      selectedText() {
        const instance = view.current;
        if (!instance) return "";
        const { from, to } = instance.state.selection.main;
        return instance.state.sliceDoc(from, to);
      },
    }),
    [fileName],
  );

  return (
    <div
      className="otion-editor"
      ref={host}
      style={{ ["--editor-font-size" as string]: `${fontSize}px` }}
    />
  );
});

export default CodeEditor;
