import type { WorktreeInfo } from "../../../main/ipc/contracts";
import { WorktreeStatusBadge } from "./WorktreeStatusBadge";
import { grove } from "../../lib/desktop-api";
import { useAppStore } from "../../state/use-app-store";

interface Props {
  worktree: WorktreeInfo;
  active: boolean;
  repoPath: string;
  onSelect?: () => void;
  onRun?: (worktreePath: string) => void;
  onPush?: (worktreePath: string) => void;
  onPull?: (worktreePath: string) => void;
}

export function WorktreeCard({ worktree, active, repoPath, onSelect, onRun, onPush, onPull }: Props) {
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  const handleSelect = async () => {
    const snapshot = await grove.setActiveWorktree({ worktreeId: worktree.id });
    setSnapshot(snapshot);
    onSelect?.();
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (worktree.isMain) return;

    const snapshot = await grove.removeWorktree({
      repoPath,
      worktreePath: worktree.path
    });
    setSnapshot(snapshot);
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRun?.(worktree.path);
  };

  const handlePush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onPush?.(worktree.path);
  };

  const handlePull = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onPull?.(worktree.path);
  };

  return (
    <button
      onClick={handleSelect}
      className={`flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
        active
          ? "border-blue-600 bg-blue-950/40"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-sm font-medium text-zinc-200">
          {worktree.branch}
        </span>
        <div className="flex items-center gap-0.5">
          {/* Run */}
          <button
            onClick={handleRun}
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-emerald-400"
            title="Run"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          {/* Push */}
          {worktree.aheadBehind.behind > 0 && (
            <button
              onClick={handlePull}
              className="flex h-5 items-center justify-center rounded px-1 text-[10px] font-medium text-amber-400 hover:bg-zinc-800 hover:text-amber-300"
              title={`Pull ${worktree.aheadBehind.behind} commit${worktree.aheadBehind.behind !== 1 ? "s" : ""}`}
            >
              {worktree.aheadBehind.behind}↓
            </button>
          )}
          {worktree.aheadBehind.ahead > 0 && (
            <button
              onClick={handlePush}
              className="flex h-5 items-center justify-center rounded px-1 text-[10px] font-medium text-blue-400 hover:bg-zinc-800 hover:text-blue-300"
              title={`Push ${worktree.aheadBehind.ahead} commit${worktree.aheadBehind.ahead !== 1 ? "s" : ""}`}
            >
              {worktree.aheadBehind.ahead}↑
            </button>
          )}
          {/* Remove */}
          {!worktree.isMain && (
            <button
              onClick={handleRemove}
              className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              title="Remove worktree"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <WorktreeStatusBadge worktree={worktree} />
      {worktree.isMain && (
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">main worktree</span>
      )}
    </button>
  );
}
