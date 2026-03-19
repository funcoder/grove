import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface Props {
  contents: string;
  language: string;
  filePath: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ contents, language, filePath, onChange }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <Editor
      key={filePath}
      defaultValue={contents}
      language={language}
      theme="vs-dark"
      onMount={handleMount}
      onChange={handleChange}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        renderWhitespace: "selection",
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
        bracketPairColorization: { enabled: true },
        automaticLayout: true,
        tabSize: 2
      }}
    />
  );
}
