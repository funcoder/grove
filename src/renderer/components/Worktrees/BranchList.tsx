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
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
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

  const handleAddWorktree = async (branch: BranchInfo) => {
    setCheckingOut(branch.name);
    try {
      const snapshot = await grove.checkoutBranch({
        repoPath: repo.repo.path,
        branchName: branch.name
      });
      setSnapshot(snapshot);
      setExpandedBranches((prev) => new Set([...prev, branch.name]));
    } finally {
      setCheckingOut(null);
    }
  };

  const handleCheckoutRemote = async (branch: BranchInfo) => {
    setCheckingOut(branch.name);
    try {
      const snapshot = await grove.checkoutRemoteBranch({
        repoPath: repo.repo.path,
        remoteBranch: branch.name
      });
      setSnapshot(snapshot);
      const localName = branch.name.replace(/^remotes\/[^/]+\//, "").replace(/^origin\//, "");
      setExpandedBranches((prev) => new Set([...prev, localName]));
    } finally {
      setCheckingOut(null);
    }
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

  const allLocal = repo.branches.filter((b) => !b.isRemote);

  // Filter remotes: exclude HEAD and those that already have a local branch
  const localNames = new Set(allLocal.map((b) => b.name));
  const remote = repo.branches.filter((b) => {
    if (!b.isRemote) return false;
    const shortName = b.name.replace(/^remotes\/[^/]+\//, "");
    if (shortName === "HEAD") return false;
    return !localNames.has(shortName);
  });

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
        {/* All local branches */}
        {allLocal.map((branch) => (
          <BranchRow
            key={branch.name}
            branch={branch}
            expanded={expandedBranches.has(branch.name)}
            activeWorktreeId={repo.activeWorktreeId}
            checkingOut={checkingOut}
            onToggle={() => toggleBranch(branch.name)}
            onSelectWorktree={handleSelectWorktree}
            onRemoveWorktree={handleRemoveWorktree}
            onAddWorktree={() => handleAddWorktree(branch)}
            onRun={onRun}
            onPush={onPush}
            onPull={onPull}
          />
        ))}

        {/* Remote branches without local counterparts */}
        {remote.length > 0 && (
          <>
            <div className="px-3 py-1.5 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Remote</span>
            </div>
            {remote.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleCheckoutRemote(branch)}
                disabled={checkingOut !== null}
                className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-zinc-600 hover:bg-zinc-800/50 hover:text-zinc-400 disabled:opacity-50"
                title="Create worktree from remote branch"
              >
                {checkingOut === branch.name ? (
                  <span className="inline-block h-3 w-3 flex-shrink-0 animate-spin rounded-full border border-zinc-600 border-t-blue-400" />
                ) : (
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9" />
                  </svg>
                )}
                <span className="truncate">{branch.name.replace(/^remotes\/origin\//, "")}</span>
              </button>
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
  checkingOut: string | null;
  onToggle: () => void;
  onSelectWorktree: (id: string) => void;
  onRemoveWorktree: (path: string) => void;
  onAddWorktree: () => void;
  onRun?: (path: string) => void;
  onPush?: (path: string) => void;
  onPull?: (path: string) => void;
}

function BranchRow({
  branch,
  expanded,
  activeWorktreeId,
  checkingOut,
  onToggle,
  onSelectWorktree,
  onRemoveWorktree,
  onAddWorktree,
  onRun,
  onPush,
  onPull
}: BranchRowProps) {
  const branchColor = branch.name === "main" || branch.name === "master"
    ? "border-emerald-600"
    : branch.hasWorktree
      ? "border-blue-600"
      : "border-zinc-700";

  const isAddingWorktree = checkingOut === branch.name;

  return (
    <div className={`border-l-2 ${branchColor} ml-2 mb-1`}>
      {/* Branch header */}
      <div className="flex items-center hover:bg-zinc-800/30">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-1.5 px-2 py-1.5 text-left min-w-0"
        >
          {branch.hasWorktree ? (
            <svg
              className={`h-3 w-3 flex-shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          ) : (
            <span className="w-3 flex-shrink-0" />
          )}
          {/* Branch icon */}
          <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <span className={`truncate text-sm font-semibold ${branch.hasWorktree ? "text-zinc-200" : "text-zinc-500"}`}>
            {branch.name}
          </span>
        </button>

        {/* Add worktree button */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddWorktree(); }}
          disabled={isAddingWorktree}
          className="flex h-6 w-6 mr-1 items-center justify-center rounded text-zinc-600 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-50"
          title="Add worktree"
        >
          {isAddingWorktree ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-blue-400" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9" />
            </svg>
          )}
        </button>
      </div>

      {/* Worktrees under this branch */}
      {expanded && branch.worktrees.length > 0 && (
        <div className="ml-3 pb-1">
          {branch.worktrees.map((wt) => {
            const isActive = wt.id === activeWorktreeId;
            const chatState = getChatState(wt.path);
            const isClaudeWorking = chatState.streaming;
            const latestTool = chatState.activeActivity[chatState.activeActivity.length - 1];

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

      {/* Expanded but no worktrees — show hint */}
      {expanded && branch.worktrees.length === 0 && (
        <div className="ml-3 pb-1 px-3 py-2">
          <span className="text-[10px] text-zinc-600">No worktrees — click + to add one</span>
        </div>
      )}
    </div>
  );
}
