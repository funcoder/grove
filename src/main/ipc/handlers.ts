import { ipcMain, BrowserWindow, dialog } from "electron";
import type { RepoController } from "../core/repo-controller.js";
import {
  OpenRepoSchema,
  CreateWorktreeSchema,
  RemoveWorktreeSchema,
  SetActiveWorktreeSchema,
  CheckoutBranchSchema,
  CheckoutRemoteBranchSchema,
  ReadDirectorySchema,
  ReadFileSchema,
  WriteFileSchema,
  GetDiffSchema,
  GetFileDiffSchema,
  StageFileSchema,
  UnstageFileSchema,
  CommitSchema,
  GenerateCommitMessageSchema,
  PullSchema,
  PushSchema,
  CommitLogSchema,
  CherryPickSchema,
  CherryPickAbortSchema,
  TerminalCreateSchema,
  TerminalWriteSchema,
  TerminalResizeSchema,
  TerminalDestroySchema,
  ClaudeSpawnSchema,
  ClaudeChatInitSchema,
  ClaudeChatSendSchema,
  ClaudeChatCancelSchema,
  ClaudeChatResetSchema,
  DetectRunCommandSchema
} from "./contracts.js";
import { FileService } from "../services/file-service.js";
import { GitService } from "../services/git-service.js";
import { TerminalService } from "../services/terminal-service.js";
import { ClaudeCodeService } from "../services/claude-code-service.js";
import { ClaudeChatService } from "../services/claude-chat-service.js";
import { RunDetector } from "../services/run-detector.js";

const runDetector = new RunDetector();

const fileService = new FileService();

const controllers = new Map<number, RepoController>();
const terminalServices = new Map<number, TerminalService>();
const claudeServices = new Map<number, ClaudeCodeService>();
const chatServices = new Map<number, ClaudeChatService>();

export const registerController = (windowId: number, controller: RepoController): void => {
  controllers.set(windowId, controller);
};

export const unregisterController = (windowId: number): void => {
  const controller = controllers.get(windowId);
  controller?.dispose();
  controllers.delete(windowId);

  terminalServices.get(windowId)?.destroyAll();
  terminalServices.delete(windowId);

  claudeServices.get(windowId)?.destroyAll();
  claudeServices.delete(windowId);

  chatServices.get(windowId)?.destroyAll();
  chatServices.delete(windowId);
};

const getController = (sender: Electron.WebContents): RepoController | undefined => {
  const window = BrowserWindow.fromWebContents(sender);
  return window ? controllers.get(window.id) : undefined;
};

const requireController = (sender: Electron.WebContents): RepoController => {
  const controller = getController(sender);
  if (!controller) {
    throw new Error("No controller for this window");
  }
  return controller;
};

const getTerminalService = (sender: Electron.WebContents): TerminalService => {
  const window = BrowserWindow.fromWebContents(sender);
  if (!window) throw new Error("No window");

  let service = terminalServices.get(window.id);
  if (!service) {
    service = new TerminalService((terminalId, data) => {
      if (!window.isDestroyed()) {
        window.webContents.send("terminal:output", terminalId, data);
      }
    });
    terminalServices.set(window.id, service);
  }
  return service;
};

const getClaudeService = (sender: Electron.WebContents): ClaudeCodeService => {
  const window = BrowserWindow.fromWebContents(sender);
  if (!window) throw new Error("No window");

  let service = claudeServices.get(window.id);
  if (!service) {
    service = new ClaudeCodeService((sessionId, data) => {
      if (!window.isDestroyed()) {
        window.webContents.send("claude:output", sessionId, data);
      }
    });
    claudeServices.set(window.id, service);
  }
  return service;
};

const getChatService = (sender: Electron.WebContents): ClaudeChatService => {
  const window = BrowserWindow.fromWebContents(sender);
  if (!window) throw new Error("No window");

  let service = chatServices.get(window.id);
  if (!service) {
    service = new ClaudeChatService((event) => {
      if (!window.isDestroyed()) {
        window.webContents.send("claude-chat:event", event);
      }
    });
    chatServices.set(window.id, service);
  }
  return service;
};

export const registerHandlers = (): void => {
  // ── App ──
  ipcMain.handle("app:getSnapshot", (event) => {
    const controller = getController(event.sender);
    return controller?.getSnapshot() ?? { repos: [], activeRepoId: "" };
  });

  ipcMain.handle("app:refresh", async (event) => {
    const controller = requireController(event.sender);
    return controller.refresh();
  });

  // ── Repo ──
  ipcMain.handle("repo:openDialog", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = window
      ? await dialog.showOpenDialog(window, {
          properties: ["openDirectory"],
          title: "Open Git Repository"
        })
      : await dialog.showOpenDialog({
          properties: ["openDirectory"],
          title: "Open Git Repository"
        });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("repo:open", async (event, input: unknown) => {
    const parsed = OpenRepoSchema.parse(input);
    return requireController(event.sender).openRepo(parsed.path);
  });

  // ── Worktree ──
  ipcMain.handle("worktree:create", async (event, input: unknown) => {
    const parsed = CreateWorktreeSchema.parse(input);
    return requireController(event.sender).createWorktree(
      parsed.repoPath,
      parsed.branchName,
      parsed.baseBranch
    );
  });

  ipcMain.handle("worktree:remove", async (event, input: unknown) => {
    const parsed = RemoveWorktreeSchema.parse(input);
    return requireController(event.sender).removeWorktree(
      parsed.repoPath,
      parsed.worktreePath
    );
  });

  ipcMain.handle("worktree:setActive", (event, input: unknown) => {
    const parsed = SetActiveWorktreeSchema.parse(input);
    return requireController(event.sender).setActiveWorktree(parsed.worktreeId);
  });

  ipcMain.handle("branch:checkout", async (event, input: unknown) => {
    const parsed = CheckoutBranchSchema.parse(input);
    return requireController(event.sender).checkoutBranch(
      parsed.repoPath,
      parsed.branchName
    );
  });

  ipcMain.handle("branch:checkoutRemote", async (event, input: unknown) => {
    const parsed = CheckoutRemoteBranchSchema.parse(input);
    return requireController(event.sender).checkoutRemoteBranch(
      parsed.repoPath,
      parsed.remoteBranch
    );
  });

  // ── Files ──
  ipcMain.handle("file:readDirectory", async (_event, input: unknown) => {
    const parsed = ReadDirectorySchema.parse(input);
    return fileService.readDirectory(parsed.dirPath);
  });

  ipcMain.handle("file:read", async (_event, input: unknown) => {
    const parsed = ReadFileSchema.parse(input);
    const contents = await fileService.readFile(parsed.filePath);
    const language = fileService.detectLanguage(parsed.filePath);
    return { contents, language };
  });

  ipcMain.handle("file:write", async (_event, input: unknown) => {
    const parsed = WriteFileSchema.parse(input);
    await fileService.writeFile(parsed.filePath, parsed.contents);
    return { ok: true };
  });

  // ── Diff ──
  ipcMain.handle("diff:getFiles", async (_event, input: unknown) => {
    const parsed = GetDiffSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    return git.getDiff(parsed.worktreePath, parsed.staged);
  });

  ipcMain.handle("diff:getFileDiff", async (_event, input: unknown) => {
    const parsed = GetFileDiffSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    const result = await git.getFileDiff(parsed.worktreePath, parsed.filePath, parsed.staged);
    const language = fileService.detectLanguage(parsed.filePath);
    return { ...result, language };
  });

  ipcMain.handle("diff:stage", async (_event, input: unknown) => {
    const parsed = StageFileSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    await git.stageFile(parsed.worktreePath, parsed.filePath);
    return { ok: true };
  });

  ipcMain.handle("diff:unstage", async (_event, input: unknown) => {
    const parsed = UnstageFileSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    await git.unstageFile(parsed.worktreePath, parsed.filePath);
    return { ok: true };
  });

  ipcMain.handle("diff:commit", async (_event, input: unknown) => {
    const parsed = CommitSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    await git.commit(parsed.worktreePath, parsed.message);
    return { ok: true };
  });

  ipcMain.handle("diff:generateMessage", async (_event, input: unknown) => {
    const parsed = GenerateCommitMessageSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    const message = await git.generateCommitMessage(parsed.worktreePath);
    return { message };
  });

  ipcMain.handle("diff:push", async (_event, input: unknown) => {
    const parsed = PushSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    await git.push(parsed.worktreePath);
    return { ok: true };
  });

  ipcMain.handle("diff:pull", async (_event, input: unknown) => {
    const parsed = PullSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    const result = await git.pull(parsed.worktreePath);
    return { ok: true, files: result.files, summary: result.summary };
  });

  // ── Cherry-Pick ──
  ipcMain.handle("git:commitLog", async (_event, input: unknown) => {
    const parsed = CommitLogSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    return git.getCommitLog(parsed.worktreePath, parsed.maxCount, parsed.branch);
  });

  ipcMain.handle("git:cherryPick", async (_event, input: unknown) => {
    const parsed = CherryPickSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    return git.cherryPick(parsed.worktreePath, parsed.commitSha);
  });

  ipcMain.handle("git:cherryPickAbort", async (_event, input: unknown) => {
    const parsed = CherryPickAbortSchema.parse(input);
    const git = new GitService(parsed.worktreePath);
    await git.cherryPickAbort(parsed.worktreePath);
    return { ok: true };
  });

  // ── Terminal ──
  ipcMain.handle("terminal:create", (event, input: unknown) => {
    const parsed = TerminalCreateSchema.parse(input);
    const service = getTerminalService(event.sender);
    return service.getOrCreate(parsed.worktreePath);
  });

  ipcMain.handle("terminal:getBuffer", (event, input: unknown) => {
    const parsed = TerminalDestroySchema.parse(input);
    const service = getTerminalService(event.sender);
    return { output: service.getBufferedOutput(parsed.terminalId) };
  });

  ipcMain.handle("terminal:write", (event, input: unknown) => {
    const parsed = TerminalWriteSchema.parse(input);
    const service = getTerminalService(event.sender);
    service.write(parsed.terminalId, parsed.data);
    return { ok: true };
  });

  ipcMain.handle("terminal:resize", (event, input: unknown) => {
    const parsed = TerminalResizeSchema.parse(input);
    const service = getTerminalService(event.sender);
    service.resize(parsed.terminalId, parsed.cols, parsed.rows);
    return { ok: true };
  });

  ipcMain.handle("terminal:destroy", (event, input: unknown) => {
    const parsed = TerminalDestroySchema.parse(input);
    const service = getTerminalService(event.sender);
    service.destroy(parsed.terminalId);
    return { ok: true };
  });

  // ── Claude Code ──
  ipcMain.handle("claude:spawn", (event, input: unknown) => {
    const parsed = ClaudeSpawnSchema.parse(input);
    const service = getClaudeService(event.sender);
    return service.getOrCreate(parsed.worktreePath);
  });

  ipcMain.handle("claude:getBuffer", (event, input: unknown) => {
    const parsed = TerminalDestroySchema.parse(input);
    const service = getClaudeService(event.sender);
    return { output: service.getBufferedOutput(parsed.terminalId) };
  });

  ipcMain.handle("claude:write", (event, input: unknown) => {
    const parsed = TerminalWriteSchema.parse(input);
    const service = getClaudeService(event.sender);
    service.write(parsed.terminalId, parsed.data);
    return { ok: true };
  });

  ipcMain.handle("claude:resize", (event, input: unknown) => {
    const parsed = TerminalResizeSchema.parse(input);
    const service = getClaudeService(event.sender);
    service.resize(parsed.terminalId, parsed.cols, parsed.rows);
    return { ok: true };
  });

  ipcMain.handle("claude:destroy", (event, input: unknown) => {
    const parsed = TerminalDestroySchema.parse(input);
    const service = getClaudeService(event.sender);
    service.destroy(parsed.terminalId);
    return { ok: true };
  });

  // ── Claude Chat ──
  ipcMain.handle("claude-chat:init", (event, input: unknown) => {
    const parsed = ClaudeChatInitSchema.parse(input);
    const service = getChatService(event.sender);
    const sessionId = service.getOrCreateSession(parsed.worktreePath);
    return { sessionId };
  });

  ipcMain.handle("claude-chat:send", async (event, input: unknown) => {
    const parsed = ClaudeChatSendSchema.parse(input);
    const service = getChatService(event.sender);
    await service.sendMessage(parsed.sessionId, parsed.message);
    return { ok: true };
  });

  ipcMain.handle("claude-chat:cancel", (event, input: unknown) => {
    const parsed = ClaudeChatCancelSchema.parse(input);
    const service = getChatService(event.sender);
    service.cancelMessage(parsed.sessionId);
    return { ok: true };
  });

  ipcMain.handle("claude-chat:reset", (event, input: unknown) => {
    const parsed = ClaudeChatResetSchema.parse(input);
    const service = getChatService(event.sender);
    const sessionId = service.resetSession(parsed.worktreePath);
    return { sessionId };
  });

  // ── Run ──
  ipcMain.handle("run:detect", async (_event, input: unknown) => {
    const parsed = DetectRunCommandSchema.parse(input);
    const result = await runDetector.detect(parsed.worktreePath);
    return result ?? { command: "", label: "unknown", source: "detected" };
  });

  ipcMain.handle("shell:openExternal", async (_event, url: string) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      throw new Error("Only http/https URLs are allowed");
    }
    const { shell } = await import("electron");
    await shell.openExternal(url);
    return { ok: true };
  });
};
