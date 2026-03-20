import { useState, useEffect, useCallback } from "react";
import type { CommitInfo, RepoSnapshot } from "../../../main/ipc/contracts";
import { grove } from "../../lib/desktop-api";
import { useToastStore } from "../../state/use-toast-store";
import { useAppStore } from "../../state/use-app-store";

interface Props {
  worktreePath: string;
  currentBranch: string;
  repo: RepoSnapshot;
  onClose: () => void;
}

export function CherryPickPanel({ worktreePath, currentBranch, repo, onClose }: Props) {
  const [sourceBranch, setSourceBranch] = useState("");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.show);
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  // Get branches that aren't the current one
  const otherBranches = repo.branches.filter(
    (b) => !b.isRemote && b.name !== currentBranch
  );

  // Auto-select first other branch
  useEffect(() => {
    if (!sourceBranch && otherBranches.length > 0) {
      setSourceBranch(otherBranches[0].name);
    }
  }, [otherBranches.length]);

  // Load commits when source branch changes
  const loadCommits = useCallback(async () => {
    if (!sourceBranch) return;
    setLoading(true);
    try {
      // Get commits from the source branch's worktree if it has one,
      // otherwise use the main repo path
      const sourceWorktree = repo.branches
        .find((b) => b.name === sourceBranch)?.worktrees[0];
      const sourcePath = sourceWorktree?.path ?? worktreePath;

      const result = await grove.getCommitLog({
        worktreePath: sourcePath,
        maxCount: 20,
        branch: sourceBranch
      });
      setCommits(result);
    } catch {
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, [sourceBranch, worktreePath, repo]);

  useEffect(() => {
    loadCommits();
  }, [loadCommits]);

  const handleCherryPick = async (sha: string) => {
    setPicking(sha);
    try {
      const result = await grove.cherryPick({ worktreePath, commitSha: sha });
      if (result.ok) {
        showToast(`Cherry-picked ${sha.slice(0, 7)}`, "success");
        const snapshot = await grove.refresh();
        setSnapshot(snapshot);
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast(
        `Cherry-pick failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setPicking(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <span className="text-sm font-semibold text-zinc-200">Cherry Pick</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            into {currentBranch}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Close
        </button>
      </div>

      {/* Source branch selector */}
      <div className="border-b border-zinc-800 px-4 py-2">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-600">
          Pick commits from
        </label>
        <select
          value={sourceBranch}
          onChange={(e) => setSourceBranch(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-purple-600"
        >
          {otherBranches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-400" />
          </div>
        ) : commits.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-zinc-600">No commits found</span>
          </div>
        ) : (
          <div className="py-1">
            {commits.map((commit) => (
              <div
                key={commit.sha}
                className="flex items-center gap-3 border-b border-zinc-800/30 px-4 py-2 hover:bg-zinc-800/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-300">{commit.message}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                    <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                    <span>{commit.author}</span>
                    <span>{formatDate(commit.date)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCherryPick(commit.sha)}
                  disabled={picking !== null}
                  className="flex-shrink-0 rounded-md bg-purple-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {picking === commit.sha ? "Picking..." : "Pick"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
