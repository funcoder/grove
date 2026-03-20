import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSnapshot,
  OpenRepoInput,
  CreateWorktreeInput,
  RemoveWorktreeInput,
  SetActiveWorktreeInput,
  CheckoutBranchInput,
  CheckoutRemoteBranchInput,
  ReadDirectoryInput,
  ReadFileInput,
  WriteFileInput,
  FileTreeNode,
  GetDiffInput,
  GetFileDiffInput,
  StageFileInput,
  UnstageFileInput,
  CommitInput,
  GenerateCommitMessageInput,
  PushInput,
  PullInput,
  PullResult,
  CommitLogInput,
  CommitInfo,
  CherryPickInput,
  CherryPickResult,
  DiffFileInfo,
  FileDiffResult,
  TerminalCreateInput,
  TerminalWriteInput,
  TerminalResizeInput,
  TerminalDestroyInput,
  ClaudeSpawnInput,
  ClaudeChatSendInput,
  ClaudeChatEvent,
  ClaudeChatResetInput,
  DetectRunCommandInput,
  RunCommandResult
} from "./ipc/contracts.js";

const api = {
  getSnapshot: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke("app:getSnapshot"),

  refresh: (): Promise<AppSnapshot> =>
    ipcRenderer.invoke("app:refresh"),

  openRepoDialog: (): Promise<{ canceled: boolean; path?: string }> =>
    ipcRenderer.invoke("repo:openDialog"),

  openRepo: (input: OpenRepoInput): Promise<AppSnapshot> =>
    ipcRenderer.invoke("repo:open", input),

  createWorktree: (input: CreateWorktreeInput): Promise<AppSnapshot> =>
    ipcRenderer.invoke("worktree:create", input),

  removeWorktree: (input: RemoveWorktreeInput): Promise<AppSnapshot> =>
    ipcRenderer.invoke("worktree:remove", input),

  setActiveWorktree: (input: SetActiveWorktreeInput): Promise<AppSnapshot> =>
    ipcRenderer.invoke("worktree:setActive", input),

  checkoutBranch: (input: CheckoutBranchInput): Promise<AppSnapshot> =>
    ipcRenderer.invoke("branch:checkout", input),

  checkoutRemoteBranch: (input: CheckoutRemoteBranchInput): Promise<AppSnapshot> =>
    ipcRenderer.invoke("branch:checkoutRemote", input),

  readDirectory: (input: ReadDirectoryInput): Promise<FileTreeNode[]> =>
    ipcRenderer.invoke("file:readDirectory", input),

  readFile: (input: ReadFileInput): Promise<{ contents: string; language: string }> =>
    ipcRenderer.invoke("file:read", input),

  writeFile: (input: WriteFileInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("file:write", input),

  getDiffFiles: (input: GetDiffInput): Promise<DiffFileInfo[]> =>
    ipcRenderer.invoke("diff:getFiles", input),

  getFileDiff: (input: GetFileDiffInput): Promise<FileDiffResult> =>
    ipcRenderer.invoke("diff:getFileDiff", input),

  stageFile: (input: StageFileInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("diff:stage", input),

  unstageFile: (input: UnstageFileInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("diff:unstage", input),

  commit: (input: CommitInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("diff:commit", input),

  generateCommitMessage: (input: GenerateCommitMessageInput): Promise<{ message: string }> =>
    ipcRenderer.invoke("diff:generateMessage", input),

  push: (input: PushInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("diff:push", input),

  pull: (input: PullInput): Promise<PullResult> =>
    ipcRenderer.invoke("diff:pull", input),

  getCommitLog: (input: CommitLogInput): Promise<CommitInfo[]> =>
    ipcRenderer.invoke("git:commitLog", input),

  cherryPick: (input: CherryPickInput): Promise<CherryPickResult> =>
    ipcRenderer.invoke("git:cherryPick", input),

  cherryPickAbort: (input: { worktreePath: string }): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("git:cherryPickAbort", input),

  // Terminal
  terminalCreate: (input: TerminalCreateInput): Promise<{ terminalId: string; existing: boolean }> =>
    ipcRenderer.invoke("terminal:create", input),

  terminalGetBuffer: (input: TerminalDestroyInput): Promise<{ output: string }> =>
    ipcRenderer.invoke("terminal:getBuffer", input),

  terminalWrite: (input: TerminalWriteInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("terminal:write", input),

  terminalResize: (input: TerminalResizeInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("terminal:resize", input),

  terminalDestroy: (input: TerminalDestroyInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("terminal:destroy", input),

  onTerminalOutput: (listener: (terminalId: string, data: string) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, terminalId: string, data: string) =>
      listener(terminalId, data);
    ipcRenderer.on("terminal:output", wrapped);
    return () => {
      ipcRenderer.removeListener("terminal:output", wrapped);
    };
  },

  // Claude Code
  claudeSpawn: (input: ClaudeSpawnInput): Promise<{ sessionId: string; existing: boolean }> =>
    ipcRenderer.invoke("claude:spawn", input),

  claudeGetBuffer: (input: TerminalDestroyInput): Promise<{ output: string }> =>
    ipcRenderer.invoke("claude:getBuffer", input),

  claudeWrite: (input: TerminalWriteInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("claude:write", input),

  claudeResize: (input: TerminalResizeInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("claude:resize", input),

  claudeDestroy: (input: TerminalDestroyInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("claude:destroy", input),

  onClaudeOutput: (listener: (sessionId: string, data: string) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) =>
      listener(sessionId, data);
    ipcRenderer.on("claude:output", wrapped);
    return () => {
      ipcRenderer.removeListener("claude:output", wrapped);
    };
  },

  // Claude Chat
  claudeChatInit: (input: { worktreePath: string }): Promise<{ sessionId: string }> =>
    ipcRenderer.invoke("claude-chat:init", input),

  claudeChatSend: (input: ClaudeChatSendInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("claude-chat:send", input),

  claudeChatCancel: (input: { sessionId: string }): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("claude-chat:cancel", input),

  claudeChatReset: (input: ClaudeChatResetInput): Promise<{ sessionId: string }> =>
    ipcRenderer.invoke("claude-chat:reset", input),

  onClaudeChatEvent: (listener: (event: ClaudeChatEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, chatEvent: ClaudeChatEvent) =>
      listener(chatEvent);
    ipcRenderer.on("claude-chat:event", wrapped);
    return () => {
      ipcRenderer.removeListener("claude-chat:event", wrapped);
    };
  },

  // Run
  detectRunCommand: (input: DetectRunCommandInput): Promise<RunCommandResult> =>
    ipcRenderer.invoke("run:detect", input),

  openExternal: (url: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("shell:openExternal", url),

  subscribeToSnapshots: (listener: (snapshot: AppSnapshot) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) =>
      listener(snapshot);
    ipcRenderer.on("app:snapshot", wrapped);
    return () => {
      ipcRenderer.removeListener("app:snapshot", wrapped);
    };
  }
};

const preloadWindow = globalThis as typeof globalThis & {
  addEventListener?: (event: string, listener: () => void) => void;
  document?: {
    documentElement?: {
      setAttribute: (name: string, value: string) => void;
    };
  };
};

preloadWindow.addEventListener?.("DOMContentLoaded", () => {
  preloadWindow.document?.documentElement?.setAttribute(
    "data-grove-preload",
    "ready"
  );
});

contextBridge.exposeInMainWorld("grove", api);

export type DesktopApi = typeof api;
