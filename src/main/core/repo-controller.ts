import type { AppSnapshot, RepoSnapshot, RepoInfo, WorktreeInfo } from "../ipc/contracts.js";
import { EMPTY_SNAPSHOT } from "../ipc/contracts.js";
import { GitService } from "../services/git-service.js";
import { WorktreeService } from "../services/worktree-service.js";
import { createHash } from "node:crypto";

export type SnapshotEmitter = (snapshot: AppSnapshot) => void;

const makeRepoId = (repoPath: string): string =>
  createHash("sha256").update(repoPath).digest("hex").slice(0, 12);

export class RepoController {
  private snapshot: AppSnapshot = { ...EMPTY_SNAPSHOT };
  private readonly emit: SnapshotEmitter;
  private readonly repos = new Map<string, { git: GitService; worktree: WorktreeService }>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(emit: SnapshotEmitter) {
    this.emit = emit;
  }

  getSnapshot(): AppSnapshot {
    return this.snapshot;
  }

  async openRepo(repoPath: string): Promise<AppSnapshot> {
    const repoId = makeRepoId(repoPath);
    const git = new GitService(repoPath);
    const worktree = new WorktreeService(repoPath);

    this.repos.set(repoId, { git, worktree });

    const repoSnapshot = await this.buildRepoSnapshot(repoId, repoPath, git);

    const next: AppSnapshot = {
      repos: [...this.snapshot.repos.filter((r) => r.repo.path !== repoPath), repoSnapshot],
      activeRepoId: repoId
    };

    this.startPolling();
    return this.pushSnapshot(next);
  }

  async createWorktree(repoPath: string, branchName: string, baseBranch: string): Promise<AppSnapshot> {
    const repoId = makeRepoId(repoPath);
    const entry = this.repos.get(repoId);
    if (!entry) throw new Error(`Repo not registered: ${repoPath}`);

    await entry.worktree.create(branchName, baseBranch);
    return this.refreshRepo(repoId, repoPath);
  }

  async removeWorktree(repoPath: string, worktreePath: string): Promise<AppSnapshot> {
    const repoId = makeRepoId(repoPath);
    const entry = this.repos.get(repoId);
    if (!entry) throw new Error(`Repo not registered: ${repoPath}`);

    await entry.worktree.remove(worktreePath);
    return this.refreshRepo(repoId, repoPath);
  }

  async checkoutBranch(repoPath: string, branchName: string): Promise<AppSnapshot> {
    const repoId = makeRepoId(repoPath);
    const entry = this.repos.get(repoId);
    if (!entry) throw new Error(`Repo not registered: ${repoPath}`);

    await entry.worktree.checkoutExisting(branchName);
    return this.refreshRepo(repoId, repoPath);
  }

  setActiveWorktree(worktreeId: string): AppSnapshot {
    const activeRepo = this.snapshot.repos.find((r) => r.repo.path);
    if (!activeRepo) return this.snapshot;

    const next: AppSnapshot = {
      ...this.snapshot,
      repos: this.snapshot.repos.map((r) =>
        r === activeRepo ? { ...r, activeWorktreeId: worktreeId } : r
      )
    };

    return this.pushSnapshot(next);
  }

  setActiveRepo(repoId: string): AppSnapshot {
    return this.pushSnapshot({ ...this.snapshot, activeRepoId: repoId });
  }

  async refresh(): Promise<AppSnapshot> {
    for (const [repoId, entry] of this.repos) {
      const repo = this.snapshot.repos.find(
        (r) => makeRepoId(r.repo.path) === repoId
      );
      if (repo) {
        await this.refreshRepo(repoId, repo.repo.path);
      }
    }
    return this.snapshot;
  }

  dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pushSnapshot(next: AppSnapshot): AppSnapshot {
    this.snapshot = next;
    this.emit(next);
    return next;
  }

  private async buildRepoSnapshot(
    repoId: string,
    repoPath: string,
    git: GitService
  ): Promise<RepoSnapshot> {
    const [name, currentBranch, remoteUrl, worktrees, branches] = await Promise.all([
      git.getRepoName(),
      git.getCurrentBranch(),
      git.getRemoteUrl(),
      git.getWorktrees(),
      git.getBranches()
    ]);

    const enrichedWorktrees = await this.enrichWorktrees(git, worktrees);

    // Enrich branches with their worktrees
    const enrichedBranches = branches.map((branch) => {
      const branchWorktrees = enrichedWorktrees.filter(
        (wt) => wt.branch === branch.name
      );
      return {
        ...branch,
        worktrees: branchWorktrees,
        hasWorktree: branchWorktrees.length > 0
      };
    });

    // Add any worktree branches not in the branch list (e.g. detached)
    for (const wt of enrichedWorktrees) {
      if (!enrichedBranches.some((b) => b.name === wt.branch)) {
        enrichedBranches.push({
          name: wt.branch,
          isRemote: false,
          isCurrent: wt.branch === currentBranch,
          worktrees: [wt],
          hasWorktree: true
        });
      }
    }

    const repo: RepoInfo = { path: repoPath, name, currentBranch, remoteUrl };

    return {
      repo,
      worktrees: enrichedWorktrees,
      activeWorktreeId: enrichedWorktrees[0]?.id ?? "",
      branches: enrichedBranches
    };
  }

  private async enrichWorktrees(git: GitService, worktrees: WorktreeInfo[]): Promise<WorktreeInfo[]> {
    return Promise.all(
      worktrees.map(async (wt) => {
        const [status, aheadBehind] = await Promise.all([
          git.getStatus(wt.path),
          git.getAheadBehind(wt.path)
        ]);

        return {
          ...wt,
          status,
          aheadBehind,
          changedFiles: status.staged + status.unstaged + status.untracked
        };
      })
    );
  }

  private async refreshRepo(repoId: string, repoPath: string): Promise<AppSnapshot> {
    const entry = this.repos.get(repoId);
    if (!entry) return this.snapshot;

    const repoSnapshot = await this.buildRepoSnapshot(repoId, repoPath, entry.git);
    const existingRepo = this.snapshot.repos.find(
      (r) => r.repo.path === repoPath
    );

    const next: AppSnapshot = {
      ...this.snapshot,
      repos: this.snapshot.repos.map((r) =>
        r.repo.path === repoPath
          ? { ...repoSnapshot, activeWorktreeId: existingRepo?.activeWorktreeId ?? repoSnapshot.activeWorktreeId }
          : r
      )
    };

    return this.pushSnapshot(next);
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const [repoId, entry] of this.repos) {
        const repo = this.snapshot.repos.find(
          (r) => makeRepoId(r.repo.path) === repoId
        );
        if (repo) {
          await this.refreshRepo(repoId, repo.repo.path);
        }
      }
    }, 5000);
  }
}
