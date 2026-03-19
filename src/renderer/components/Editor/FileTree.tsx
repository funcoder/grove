import { useState, useEffect } from "react";
import type { FileTreeNode } from "../../../main/ipc/contracts";
import { grove } from "../../lib/desktop-api";
import { FileIcon } from "./FileIcon";

interface Props {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
  activeFilePath?: string;
}

export function FileTree({ rootPath, onFileSelect, activeFilePath }: Props) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    grove.readDirectory({ dirPath: rootPath }).then((nodes) => {
      setTree(nodes);
      setLoading(false);
    });
  }, [rootPath]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-xs text-zinc-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Files</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onFileSelect={onFileSelect}
            activeFilePath={activeFilePath}
          />
        ))}
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  onFileSelect: (filePath: string) => void;
  activeFilePath?: string;
}

function TreeNode({ node, depth, onFileSelect, activeFilePath }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = node.path === activeFilePath;
  const paddingLeft = 12 + depth * 16;

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 py-0.5 text-left text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          style={{ paddingLeft }}
        >
          <svg
            className={`h-3 w-3 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <svg className={`h-4 w-4 flex-shrink-0 ${expanded ? "text-blue-400" : "text-zinc-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {expanded ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            )}
          </svg>
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onFileSelect={onFileSelect}
            activeFilePath={activeFilePath}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={`flex w-full items-center gap-1.5 py-0.5 text-left text-sm truncate ${
        isActive
          ? "bg-blue-950/40 text-blue-300"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      }`}
      style={{ paddingLeft: paddingLeft + 16 }}
    >
      <FileIcon fileName={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
