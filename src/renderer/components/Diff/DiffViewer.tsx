import { useRef, useEffect } from "react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface Props {
  original: string;
  modified: string;
  language: string;
  filePath: string;
}

export function DiffViewer({ original, modified, language, filePath }: Props) {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  const handleMount: DiffOnMount = (editor) => {
    editorRef.current = editor;
  };

  // Update editor content when original/modified change without remounting
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const originalModel = editor.getModel()?.original;
    const modifiedModel = editor.getModel()?.modified;

    if (originalModel && originalModel.getValue() !== original) {
      originalModel.setValue(original);
    }
    if (modifiedModel && modifiedModel.getValue() !== modified) {
      modifiedModel.setValue(modified);
    }
  }, [original, modified]);

  return (
    <DiffEditor
      key={filePath}
      original={original}
      modified={modified}
      language={language}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderSideBySide: true,
        readOnly: true,
        automaticLayout: true
      }}
    />
  );
}
