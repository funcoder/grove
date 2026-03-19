import { simpleGit, type SimpleGit } from "simple-git";
import type { WorktreeInfo, WorktreeStatus, AheadBehind, BranchInfo, DiffFileInfo, DiffFileStatus } from "../ipc/contracts.js";
import { createHash } from "node:crypto";

const makeId = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);

export class GitService {
  private readonly git: SimpleGit;
  private readonly repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async getWorktrees(): Promise<WorktreeInfo[]> {
    const raw = await this.git.raw(["worktree", "list", "--porcelain"]);
    return this.parseWorktreeList(raw);
  }

  async getStatus(worktreePath: string): Promise<WorktreeStatus> {
    try {
      const wt = simpleGit(worktreePath);
      const status = await wt.status();

      return {
        dirty: !status.isClean(),
        staged: status.staged.length,
        unstaged: status.modified.length + status.deleted.length,
        untracked: status.not_added.length
      };
    } catch {
      return { dirty: false, staged: 0, unstaged: 0, untracked: 0 };
    }
  }

  async getAheadBehind(worktreePath: string): Promise<AheadBehind> {
    const wt = simpleGit(worktreePath);

    try {
      const status = await wt.status();

      // If git status reports ahead/behind (has tracking branch), use that
      if (status.tracking) {
        return { ahead: status.ahead, behind: status.behind };
      }

      // No tracking branch — count all commits as unpushed
      const log = await wt.log();
      return { ahead: log.total, behind: 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  async getBranches(): Promise<BranchInfo[]> {
    try {
      const summary = await this.git.branch(["-a"]);
      const branches: BranchInfo[] = [];

      for (const [name, info] of Object.entries(summary.branches)) {
        branches.push({
          name: info.name,
          isRemote: name.startsWith("remotes/"),
          isCurrent: info.current,
          worktrees: [],
          hasWorktree: false
        });
      }

      return branches;
    } catch {
      return [{ name: "main", isRemote: false, isCurrent: true, worktrees: [], hasWorktree: false }];
    }
  }

  async getRepoName(): Promise<string> {
    try {
      const remoteUrl = await this.git.remote(["get-url", "origin"]);
      if (remoteUrl) {
        const cleaned = remoteUrl.trim().replace(/\.git$/, "");
        const parts = cleaned.split("/");
        return parts[parts.length - 1] || "unknown";
      }
    } catch {
      // No remote
    }

    const parts = this.repoPath.split("/");
    return parts[parts.length - 1] || "unknown";
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(["--abbrev-ref", "HEAD"]);
      return branch.trim();
    } catch {
      return "main";
    }
  }

  async getRemoteUrl(): Promise<string | undefined> {
    try {
      const url = await this.git.remote(["get-url", "origin"]);
      return url?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  async getDiff(worktreePath: string, staged: boolean): Promise<DiffFileInfo[]> {
    const wt = simpleGit(worktreePath);

    // Get line counts
    const numstatArgs = staged ? ["diff", "--cached", "--numstat"] : ["diff", "--numstat"];
    const numstatRaw = await wt.raw(numstatArgs);
    const lineCounts = new Map<string, { additions: number; deletions: number }>();

    for (const line of numstatRaw.trim().split("\n")) {
      if (!line.trim()) continue;
      const [addStr, delStr, filePath] = line.split("\t");
      if (!filePath) continue;
      lineCounts.set(filePath, {
        additions: parseInt(addStr ?? "0", 10) || 0,
        deletions: parseInt(delStr ?? "0", 10) || 0
      });
    }

    // Get file statuses (A/M/D/R)
    const statusArgs = staged ? ["diff", "--cached", "--name-status"] : ["diff", "--name-status"];
    const statusRaw = await wt.raw(statusArgs);
    const fileStatuses = new Map<string, DiffFileStatus>();

    for (const line of statusRaw.trim().split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      const statusChar = (parts[0] ?? "")[0];
      const filePath = parts[1] ?? "";
      if (!filePath) continue;

      const statusMap: Record<string, DiffFileStatus> = {
        A: "added", M: "modified", D: "deleted", R: "renamed"
      };
      fileStatuses.set(filePath, statusMap[statusChar ?? ""] ?? "modified");
    }

    const files: DiffFileInfo[] = [];

    // Merge numstat + name-status
    const allPaths = new Set([...lineCounts.keys(), ...fileStatuses.keys()]);
    for (const filePath of allPaths) {
      const counts = lineCounts.get(filePath) ?? { additions: 0, deletions: 0 };
      files.push({
        filePath,
        status: fileStatuses.get(filePath) ?? "modified",
        staged,
        additions: counts.additions,
        deletions: counts.deletions
      });
    }

    // For unstaged: also include untracked files
    if (!staged) {
      const status = await wt.status();
      for (const file of status.not_added) {
        if (!files.some((f) => f.filePath === file)) {
          files.push({
            filePath: file,
            status: "added",
            staged: false,
            additions: 0,
            deletions: 0
          });
        }
      }
    }

    return files;
  }

  async getFileDiff(
    worktreePath: string,
    filePath: string,
    staged: boolean
  ): Promise<{ original: string; modified: string }> {
    const wt = simpleGit(worktreePath);

    try {
      const args = staged
        ? ["show", `HEAD:${filePath}`]
        : ["show", `:${filePath}`];
      const original = await wt.raw(args);
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const modified = await readFile(join(worktreePath, filePath), "utf-8");
      return { original, modified };
    } catch {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      try {
        const modified = await readFile(join(worktreePath, filePath), "utf-8");
        return { original: "", modified };
      } catch {
        return { original: "", modified: "" };
      }
    }
  }

  async stageFile(worktreePath: string, filePath: string): Promise<void> {
    const wt = simpleGit(worktreePath);
    await wt.add(filePath);
  }

  async unstageFile(worktreePath: string, filePath: string): Promise<void> {
    const wt = simpleGit(worktreePath);
    await wt.raw(["reset", "HEAD", filePath]);
  }

  async commit(worktreePath: string, message: string): Promise<void> {
    const wt = simpleGit(worktreePath);
    await wt.add("-A");
    await wt.commit(message);
  }

  async push(worktreePath: string): Promise<void> {
    const wt = simpleGit(worktreePath);
    await wt.push(["-u", "origin", "HEAD"]);
  }

  async pull(worktreePath: string): Promise<void> {
    const wt = simpleGit(worktreePath);
    await wt.pull();
  }

  async generateCommitMessage(worktreePath: string): Promise<string> {
    let files = await this.getDiff(worktreePath, true);
    if (files.length === 0) {
      files = await this.getDiff(worktreePath, false);
    }
    if (files.length === 0) return "";

    const added = files.filter((f) => f.status === "added");
    const modified = files.filter((f) => f.status === "modified");
    const deleted = files.filter((f) => f.status === "deleted");

    // Determine commit type
    let type = "chore";
    if (added.length > 0 && modified.length === 0 && deleted.length === 0) {
      type = "feat";
    } else if (deleted.length > 0 && added.length === 0 && modified.length === 0) {
      type = "refactor";
    } else if (modified.length > 0 && added.length === 0) {
      type = files.every((f) => f.filePath.includes("test") || f.filePath.includes("spec"))
        ? "test"
        : "fix";
    } else if (added.length > 0 && modified.length > 0) {
      type = "feat";
    }

    // Find common directory scope
    const dirs = files.map((f) => {
      const parts = f.filePath.split("/");
      return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    });
    const uniqueDirs = [...new Set(dirs)].filter(Boolean);
    const scope = uniqueDirs.length === 1 ? uniqueDirs[0] : "";

    // Build description
    const parts: string[] = [];
    if (added.length > 0) parts.push(`add ${this.summarizeFiles(added)}`);
    if (modified.length > 0) parts.push(`update ${this.summarizeFiles(modified)}`);
    if (deleted.length > 0) parts.push(`remove ${this.summarizeFiles(deleted)}`);

    const description = parts.join(", ");
    const scopePart = scope ? `(${scope.split("/").pop()})` : "";

    const totalAdded = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeleted = files.reduce((sum, f) => sum + f.deletions, 0);

    let message = `${type}${scopePart}: ${description}`;

    if (files.length > 1) {
      message += `\n\n${files.length} files changed`;
      if (totalAdded > 0) message += `, +${totalAdded}`;
      if (totalDeleted > 0) message += `, -${totalDeleted}`;
    }

    return message;
  }

  private summarizeFiles(files: DiffFileInfo[]): string {
    const names = files.map((f) => {
      const parts = f.filePath.split("/");
      return parts[parts.length - 1] ?? f.filePath;
    });

    if (names.length <= 3) {
      return names.join(", ");
    }

    return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  }

  private parseWorktreeList(raw: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const blocks = raw.trim().split("\n\n");

    for (const block of blocks) {
      const lines = block.trim().split("\n");
      let wtPath = "";
      let branch = "";
      let isBare = false;

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          wtPath = line.slice("worktree ".length);
        } else if (line.startsWith("branch ")) {
          branch = line.slice("branch ".length).replace("refs/heads/", "");
        } else if (line === "bare") {
          isBare = true;
        } else if (line === "detached") {
          branch = "(detached)";
        }
      }

      if (isBare || !wtPath) continue;

      const isMain = wtPath === this.repoPath;

      worktrees.push({
        id: makeId(wtPath),
        path: wtPath,
        branch,
        isMain,
        status: { dirty: false, staged: 0, unstaged: 0, untracked: 0 },
        aheadBehind: { ahead: 0, behind: 0 },
        changedFiles: 0
      });
    }

    return worktrees;
  }
}
