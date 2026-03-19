import { useState } from "react";
import type { RepoSnapshot, BranchInfo } from "../../../main/ipc/contracts";
import { WorktreeStatusBadge } from "./WorktreeStatusBadge";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";
import { grove } from "../../lib/desktop-api";
import { useAppStore } from "../../state/use-app-store";
import { getChatState } from "../../lib/chat-store";

interface Props {
  repo: RepoSnapshot;
  onWorktreeSelect?: () => void;
  onRun?: (worktreePath: string) => void;
  onPush?: (worktreePath: string) => void;
  onPull?: (worktreePath: string) => void;
}

export function BranchList({ repo, onWorktreeSelect, onRun, onPush, onPull }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(repo.branches.filter((b) => b.hasWorktree).map((b) => b.name))
  );
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  const toggleBranch = (name: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleCheckout = async (branch: BranchInfo) => {
    const snapshot = await grove.checkoutBranch({
      repoPath: repo.repo.path,
      branchName: branch.name
    });
    setSnapshot(snapshot);
    setExpandedBranches((prev) => new Set([...prev, branch.name]));
  };

  const handleSelectWorktree = async (worktreeId: string) => {
    const snapshot = await grove.setActiveWorktree({ worktreeId });
    setSnapshot(snapshot);
    onWorktreeSelect?.();
  };

  const handleRemoveWorktree = async (worktreePath: string) => {
    const snapshot = await grove.removeWorktree({
      repoPath: repo.repo.path,
      worktreePath
    });
    setSnapshot(snapshot);
  };

  const localWithWt = repo.branches.filter((b) => !b.isRemote && b.hasWorktree);
  const localWithout = repo.branches.filter((b) => !b.isRemote && !b.hasWorktree);
  const remote = repo.branches.filter((b) => b.isRemote);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Branches
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="New branch"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {localWithWt.map((branch) => (
          <BranchRow
            key={branch.name}
            branch={branch}
            expanded={expandedBranches.has(branch.name)}
            activeWorktreeId={repo.activeWorktreeId}
            onToggle={() => toggleBranch(branch.name)}
            onSelectWorktree={handleSelectWorktree}
            onRemoveWorktree={handleRemoveWorktree}
            onRun={onRun}
            onPush={onPush}
            onPull={onPull}
          />
        ))}

        {localWithout.length > 0 && (
          <>
            <div className="px-3 py-1.5 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Other branches</span>
            </div>
            {localWithout.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleCheckout(branch)}
                className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-zinc-600 hover:bg-zinc-800/50 hover:text-zinc-400"
                title="Add worktree for this branch"
              >
                <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9" />
                </svg>
                <span className="truncate">{branch.name}</span>
              </button>
            ))}
          </>
        )}

        {remote.length > 0 && (
          <>
            <div className="px-3 py-1.5 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Remote</span>
            </div>
            {remote.map((branch) => (
              <div
                key={branch.name}
                className="flex items-center px-3 py-1 text-xs text-zinc-700"
              >
                <span className="truncate">{branch.name.replace("remotes/origin/", "")}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {showCreate && (
        <CreateWorktreeDialog
          repoPath={repo.repo.path}
          branches={repo.branches}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ── Branch Row ──────────────────────────────────────────────────

interface BranchRowProps {
  branch: BranchInfo;
  expanded: boolean;
  activeWorktreeId: string;
  onToggle: () => void;
  onSelectWorktree: (id: string) => void;
  onRemoveWorktree: (path: string) => void;
  onRun?: (path: string) => void;
  onPush?: (path: string) => void;
  onPull?: (path: string) => void;
}

function BranchRow({
  branch,
  expanded,
  activeWorktreeId,
  onToggle,
  onSelectWorktree,
  onRemoveWorktree,
  onRun,
  onPush,
  onPull
}: BranchRowProps) {
  // Branch color based on name
  const branchColor = branch.name === "main" || branch.name === "master"
    ? "border-emerald-600"
    : "border-blue-600";

  return (
    <div className={`border-l-2 ${branchColor} ml-2 mb-1`}>
      {/* Branch header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-zinc-800/30"
      >
        <svg
          className={`h-3 w-3 flex-shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        {/* Branch icon */}
        <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        <span className="truncate text-sm font-semibold text-zinc-200">{branch.name}</span>
      </button>

      {/* Worktrees under this branch */}
      {expanded && (
        <div className="ml-3 pb-1">
          {branch.worktrees.map((wt) => {
            const isActive = wt.id === activeWorktreeId;
            const chatState = getChatState(wt.path);
            const isClaudeWorking = chatState.streaming;
            const latestTool = chatState.activity[chatState.activity.length - 1];

            return (
              <div
                key={wt.id}
                onClick={() => onSelectWorktree(wt.id)}
                className={`mx-1 mb-0.5 rounded-md border px-2.5 py-2 cursor-pointer transition-colors ${
                  isActive
                    ? "border-blue-500/60 bg-blue-950/30"
                    : "border-zinc-800/40 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800/30"
                }`}
              >
                {/* Worktree name + actions */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                    <span className="truncate text-xs text-zinc-300">
                      {wt.path.split("/").pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRun?.(wt.path); }}
                      className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 hover:text-emerald-400"
                      title="Run"
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    {wt.aheadBehind.behind > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPull?.(wt.path); }}
                        className="px-1 text-[10px] font-medium text-amber-400 hover:text-amber-300"
                        title={`Pull ${wt.aheadBehind.behind}`}
                      >
                        {wt.aheadBehind.behind}↓
                      </button>
                    )}
                    {wt.aheadBehind.ahead > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPush?.(wt.path); }}
                        className="px-1 text-[10px] font-medium text-blue-400 hover:text-blue-300"
                        title={`Push ${wt.aheadBehind.ahead}`}
                      >
                        {wt.aheadBehind.ahead}↑
                      </button>
                    )}
                    {!wt.isMain && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveWorktree(wt.path); }}
                        className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 hover:text-red-400"
                        title="Remove worktree"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status or Claude activity */}
                {isClaudeWorking ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 animate-spin rounded-full border border-zinc-600 border-t-amber-400" />
                    <span className="truncate text-[11px] text-amber-400">
                      {latestTool?.toolName ?? "Working"}{latestTool?.detail ? `: ${latestTool.detail}` : ""}
                    </span>
                  </div>
                ) : (
                  <WorktreeStatusBadge worktree={wt} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
