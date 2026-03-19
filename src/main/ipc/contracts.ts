import { z } from "zod";

// ── Worktree Types ──────────────────────────────────────────────

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  isMain: boolean;
  status: WorktreeStatus;
  aheadBehind: AheadBehind;
  changedFiles: number;
}

export interface WorktreeStatus {
  dirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

// ── Repo Types ──────────────────────────────────────────────────

export interface RepoInfo {
  path: string;
  name: string;
  currentBranch: string;
  remoteUrl?: string;
}

// ── Snapshot Types ──────────────────────────────────────────────

export interface RepoSnapshot {
  repo: RepoInfo;
  worktrees: WorktreeInfo[];
  activeWorktreeId: string;
  branches: BranchInfo[];
}

export interface AppSnapshot {
  repos: RepoSnapshot[];
  activeRepoId: string;
}

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  worktrees: WorktreeInfo[];
  hasWorktree: boolean;
}

// ── IPC Input Types ─────────────────────────────────────────────

export interface OpenRepoInput {
  path: string;
}

export interface CreateWorktreeInput {
  repoPath: string;
  branchName: string;
  baseBranch: string;
}

export interface RemoveWorktreeInput {
  repoPath: string;
  worktreePath: string;
}

export interface SetActiveWorktreeInput {
  worktreeId: string;
}

export interface CheckoutBranchInput {
  repoPath: string;
  branchName: string;
}

// ── File Types ──────────────────────────────────────────────────

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface TabInfo {
  filePath: string;
  label: string;
  dirty: boolean;
  language: string;
}

export interface ReadDirectoryInput {
  dirPath: string;
}

export interface ReadFileInput {
  filePath: string;
}

export interface WriteFileInput {
  filePath: string;
  contents: string;
}

// ── Diff Types ──────────────────────────────────────────────────

export type DiffFileStatus = "added" | "modified" | "deleted" | "renamed";

export interface DiffFileInfo {
  filePath: string;
  status: DiffFileStatus;
  staged: boolean;
  additions: number;
  deletions: number;
}

export interface FileDiffResult {
  original: string;
  modified: string;
  language: string;
}

export interface GetDiffInput {
  worktreePath: string;
  staged: boolean;
}

export interface GetFileDiffInput {
  worktreePath: string;
  filePath: string;
  staged: boolean;
}

export interface StageFileInput {
  worktreePath: string;
  filePath: string;
}

export interface UnstageFileInput {
  worktreePath: string;
  filePath: string;
}

export interface CommitInput {
  worktreePath: string;
  message: string;
}

export interface GenerateCommitMessageInput {
  worktreePath: string;
}

export interface PushInput {
  worktreePath: string;
}

// ── Run Types ───────────────────────────────────────────────────

export interface DetectRunCommandInput {
  worktreePath: string;
}

export interface RunCommandResult {
  command: string;
  label: string;
  source: "detected" | "ai";
  opensUrl?: string;
}

export const DetectRunCommandSchema = z.object({
  worktreePath: z.string().min(1)
});

// ── Terminal Types ──────────────────────────────────────────────

export interface TerminalCreateInput {
  worktreePath: string;
}

export interface TerminalWriteInput {
  terminalId: string;
  data: string;
}

export interface TerminalResizeInput {
  terminalId: string;
  cols: number;
  rows: number;
}

export interface TerminalDestroyInput {
  terminalId: string;
}

// ── Claude Code Types (Terminal) ────────────────────────────────

export interface ClaudeSpawnInput {
  worktreePath: string;
}

export interface ClaudeSessionInfo {
  worktreeId: string;
  active: boolean;
  terminalId: string;
}

// ── Zod Schemas (IPC input validation) ──────────────────────────

export const TerminalCreateSchema = z.object({
  worktreePath: z.string().min(1)
});

export const TerminalWriteSchema = z.object({
  terminalId: z.string().min(1),
  data: z.string()
});

export const TerminalResizeSchema = z.object({
  terminalId: z.string().min(1),
  cols: z.number().int().min(1),
  rows: z.number().int().min(1)
});

export const TerminalDestroySchema = z.object({
  terminalId: z.string().min(1)
});

export const ClaudeSpawnSchema = z.object({
  worktreePath: z.string().min(1)
});

// ── Claude Chat Types ───────────────────────────────────────────

export interface ClaudeChatSendInput {
  sessionId: string;
  message: string;
}

export interface ClaudeChatEvent {
  sessionId: string;
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  content: string;
  toolName?: string;
}

export const ClaudeChatInitSchema = z.object({
  worktreePath: z.string().min(1)
});

export const ClaudeChatSendSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1)
});

export const ClaudeChatCancelSchema = z.object({
  sessionId: z.string().min(1)
});

export const OpenRepoSchema = z.object({
  path: z.string().min(1)
});

export const CreateWorktreeSchema = z.object({
  repoPath: z.string().min(1),
  branchName: z.string().min(1).regex(/^[a-zA-Z0-9._\-/]+$/, "Invalid branch name"),
  baseBranch: z.string().min(1)
});

export const RemoveWorktreeSchema = z.object({
  repoPath: z.string().min(1),
  worktreePath: z.string().min(1)
});

export const SetActiveWorktreeSchema = z.object({
  worktreeId: z.string().min(1)
});

export const CheckoutBranchSchema = z.object({
  repoPath: z.string().min(1),
  branchName: z.string().min(1)
});

export const ReadDirectorySchema = z.object({
  dirPath: z.string().min(1)
});

export const ReadFileSchema = z.object({
  filePath: z.string().min(1)
});

export const WriteFileSchema = z.object({
  filePath: z.string().min(1),
  contents: z.string()
});

export const GetDiffSchema = z.object({
  worktreePath: z.string().min(1),
  staged: z.boolean()
});

export const GetFileDiffSchema = z.object({
  worktreePath: z.string().min(1),
  filePath: z.string().min(1),
  staged: z.boolean()
});

export const StageFileSchema = z.object({
  worktreePath: z.string().min(1),
  filePath: z.string().min(1)
});

export const UnstageFileSchema = z.object({
  worktreePath: z.string().min(1),
  filePath: z.string().min(1)
});

export const CommitSchema = z.object({
  worktreePath: z.string().min(1),
  message: z.string().min(1)
});

export const GenerateCommitMessageSchema = z.object({
  worktreePath: z.string().min(1)
});

export const PushSchema = z.object({
  worktreePath: z.string().min(1)
});

// ── Empty Snapshot ──────────────────────────────────────────────

export const EMPTY_SNAPSHOT: AppSnapshot = {
  repos: [],
  activeRepoId: ""
};
