import type { WorktreeInfo } from "../../../main/ipc/contracts";

interface Props {
  worktree: WorktreeInfo;
}

export function WorktreeStatusBadge({ worktree }: Props) {
  const { status, aheadBehind } = worktree;

  const color = status.dirty ? "bg-amber-500" : "bg-emerald-500";
  const label = status.dirty
    ? `${worktree.changedFiles} changed`
    : "clean";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-zinc-400">{label}</span>
      {aheadBehind.ahead > 0 && (
        <span className="rounded bg-blue-900/50 px-1 py-0.5 text-[10px] font-medium text-blue-300">
          {aheadBehind.ahead}↑ to push
        </span>
      )}
      {aheadBehind.behind > 0 && (
        <span className="rounded bg-amber-900/50 px-1 py-0.5 text-[10px] font-medium text-amber-300">
          {aheadBehind.behind}↓ to pull
        </span>
      )}
    </div>
  );
}
