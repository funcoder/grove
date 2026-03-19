import { simpleGit } from "simple-git";
import path from "node:path";
import { access, copyFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class WorktreeService {
  private readonly repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async create(branchName: string, baseBranch: string): Promise<string> {
    const git = simpleGit(this.repoPath);
    const worktreePath = this.getWorktreePath(branchName);

    await git.raw(["worktree", "add", "-b", branchName, worktreePath, baseBranch]);
    await this.runSetupHooks(worktreePath);

    return worktreePath;
  }

  async checkoutExisting(branchName: string): Promise<string> {
    const git = simpleGit(this.repoPath);
    const worktreePath = this.getWorktreePath(branchName);

    await git.raw(["worktree", "add", worktreePath, branchName]);
    await this.runSetupHooks(worktreePath);

    return worktreePath;
  }

  async remove(worktreePath: string): Promise<void> {
    const git = simpleGit(this.repoPath);
    await git.raw(["worktree", "remove", worktreePath, "--force"]);
  }

  async runSetupHooks(worktreePath: string): Promise<void> {
    await this.copyEnvFile(worktreePath);
    await this.installDependencies(worktreePath);
  }

  private getWorktreePath(branchName: string): string {
    const safeName = branchName.replace(/\//g, "-");
    const parentDir = path.dirname(this.repoPath);
    const repoName = path.basename(this.repoPath);
    return path.join(parentDir, `${repoName}-wt-${safeName}`);
  }

  private async copyEnvFile(worktreePath: string): Promise<void> {
    const sourceEnv = path.join(this.repoPath, ".env");

    try {
      await access(sourceEnv);
      await copyFile(sourceEnv, path.join(worktreePath, ".env"));
    } catch {
      // No .env to copy
    }
  }

  private async installDependencies(worktreePath: string): Promise<void> {
    const packageJson = path.join(worktreePath, "package.json");

    try {
      await access(packageJson);
      await execAsync("pnpm install", { cwd: worktreePath });
    } catch {
      // No package.json or install failed
    }
  }
}
