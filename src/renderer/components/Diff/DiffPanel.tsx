import { useState, useEffect, useCallback, useRef } from "react";
import type { DiffFileInfo, FileDiffResult } from "../../../main/ipc/contracts";
import { grove } from "../../lib/desktop-api";
import { useAppStore } from "../../state/use-app-store";
import { DiffFileList } from "./DiffFileList";
import { DiffViewer } from "./DiffViewer";
import { DiffToolbar } from "./DiffToolbar";

interface Props {
  worktreePath: string;
}

export function DiffPanel({ worktreePath }: Props) {
  const setSnapshot = useAppStore((s) => s.setSnapshot);
  const repos = useAppStore((s) => s.repos);
  const activeWorktree = repos[0]?.worktrees.find((wt) => wt.path === worktreePath);
  const aheadCount = activeWorktree?.aheadBehind.ahead ?? 0;
  const [showStaged, setShowStaged] = useState(false);
  const [files, setFiles] = useState<DiffFileInfo[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>();
  const [diff, setDiff] = useState<FileDiffResult | null>(null);
  const activeFileRef = useRef(activeFilePath);
  const showStagedRef = useRef(showStaged);

  activeFileRef.current = activeFilePath;
  showStagedRef.current = showStaged;

  const loadFiles = useCallback(async () => {
    const result = await grove.getDiffFiles({
      worktreePath,
      staged: showStagedRef.current
    });
    setFiles(result);
    return result;
  }, [worktreePath]);

  const loadActiveDiff = useCallback(async () => {
    const filePath = activeFileRef.current;
    if (!filePath) return;

    const result = await grove.getFileDiff({
      worktreePath,
      filePath,
      staged: showStagedRef.current
    });
    setDiff(result);
  }, [worktreePath]);

  // Initial load + poll every 2s
  useEffect(() => {
    loadFiles();

    const interval = setInterval(async () => {
      const result = await loadFiles();

      // Auto-refresh the active diff if the file is still in the list
      const activePath = activeFileRef.current;
      if (activePath && result.some((f) => f.filePath === activePath)) {
        await loadActiveDiff();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [loadFiles, loadActiveDiff]);

  // Load diff when active file or staged toggle changes
  useEffect(() => {
    if (!activeFilePath) {
      setDiff(null);
      return;
    }

    loadActiveDiff();
  }, [activeFilePath, showStaged, loadActiveDiff]);

  const handleStage = async (filePath: string) => {
    await grove.stageFile({ worktreePath, filePath });
    await loadFiles();
  };

  const handleUnstage = async (filePath: string) => {
    await grove.unstageFile({ worktreePath, filePath });
    await loadFiles();
  };

  const handleCommit = async (message: string) => {
    await grove.commit({ worktreePath, message });
    setDiff(null);
    setActiveFilePath(undefined);
    await loadFiles();

    // Force full git re-query so worktree badge + ahead count update immediately
    const snapshot = await grove.refresh();
    setSnapshot(snapshot);
  };

  return (
    <div className="flex h-full flex-col">
      <DiffToolbar
        showStaged={showStaged}
        onToggleStaged={() => setShowStaged(!showStaged)}
        onCommit={handleCommit}
        onGenerateMessage={async () => {
          const { message } = await grove.generateCommitMessage({ worktreePath });
          return message;
        }}
        onPush={async () => {
          await grove.push({ worktreePath });
          const snapshot = await grove.refresh();
          setSnapshot(snapshot);
        }}
        hasChanges={files.length > 0}
        aheadCount={aheadCount}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 border-r border-zinc-800 overflow-y-auto">
          <DiffFileList
            files={files}
            activeFilePath={activeFilePath}
            onSelectFile={setActiveFilePath}
            onStageFile={handleStage}
            onUnstageFile={handleUnstage}
            showStaged={showStaged}
          />
        </div>
        <div className="flex-1">
          {diff ? (
            <DiffViewer
              original={diff.original}
              modified={diff.modified}
              language={diff.language}
              filePath={activeFilePath ?? ""}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-zinc-500">Select a file to view diff</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
