import { useState } from "react";
import type { BranchInfo } from "../../../main/ipc/contracts";
import { grove } from "../../lib/desktop-api";
import { useAppStore } from "../../state/use-app-store";

interface Props {
  repoPath: string;
  branches: BranchInfo[];
  onClose: () => void;
}

export function CreateWorktreeDialog({ repoPath, branches, onClose }: Props) {
  const [branchName, setBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState(
    branches.find((b) => b.isCurrent)?.name ?? "main"
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  const localBranches = branches.filter((b) => !b.isRemote);

  const handleCreate = async () => {
    if (!branchName.trim()) return;

    setCreating(true);
    setError("");

    try {
      const snapshot = await grove.createWorktree({
        repoPath,
        branchName: branchName.trim(),
        baseBranch
      });
      setSnapshot(snapshot);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create worktree");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-96 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-200">New Worktree</h2>

        <label className="mb-1 block text-xs text-zinc-400">Branch name</label>
        <input
          type="text"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          placeholder="feature/my-feature"
          className="mb-3 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-600"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />

        <label className="mb-1 block text-xs text-zinc-400">Base branch</label>
        <select
          value={baseBranch}
          onChange={(e) => setBaseBranch(e.target.value)}
          className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-600"
        >
          {localBranches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>

        {error && (
          <p className="mb-3 text-xs text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!branchName.trim() || creating}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
