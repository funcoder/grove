import { useState } from "react";
import type { RepoSnapshot } from "../../../main/ipc/contracts";
import { WorktreeCard } from "./WorktreeCard";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";

interface Props {
  repo: RepoSnapshot;
  onWorktreeSelect?: () => void;
  onRun?: (worktreePath: string) => void;
  onPush?: (worktreePath: string) => void;
  onPull?: (worktreePath: string) => void;
}

export function WorktreeList({ repo, onWorktreeSelect, onRun, onPush, onPull }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Worktrees
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="New worktree"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {repo.worktrees.map((wt) => (
          <WorktreeCard
            key={wt.id}
            worktree={wt}
            active={wt.id === repo.activeWorktreeId}
            repoPath={repo.repo.path}
            onSelect={onWorktreeSelect}
            onRun={onRun}
            onPush={onPush}
            onPull={onPull}
          />
        ))}
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
