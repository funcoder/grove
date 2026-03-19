import { useState, useCallback, useRef, useEffect } from "react";
import { useAppStore } from "../../state/use-app-store";
import { grove } from "../../lib/desktop-api";
import { BranchList } from "../Worktrees/BranchList";
import { FileTree } from "../Editor/FileTree";
import { CodeEditor } from "../Editor/CodeEditor";
import { EditorTabs } from "../Editor/EditorTabs";
import { DiffViewer } from "../Diff/DiffViewer";
import { DiffToolbar } from "../Diff/DiffToolbar";
import { TerminalPanel } from "../Terminal/TerminalPanel";
import { ChatPanel } from "../Chat/ChatPanel";
import { ResizeHandle } from "./ResizeHandle";
import { HorizontalResizeHandle } from "./HorizontalResizeHandle";
import { shellStore } from "../../lib/terminal-stores";
import type { TabInfo } from "../../../main/ipc/contracts";

type SidebarPanel = "worktrees" | "files" | null;

interface OpenFile {
  filePath: string;
  contents: string;
  language: string;
  dirty: boolean;
  savedContents: string;
  isDiff?: boolean;
  originalContents?: string;
}

export function Shell() {
  const repos = useAppStore((s) => s.repos);
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("worktrees");
  const [showTerminal, setShowTerminal] = useState(false);
  const [showCommitBar, setShowCommitBar] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [claudePanelWidth, setClaudePanelWidth] = useState(384);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeRepo = repos[0];
  const activeWorktree = activeRepo?.worktrees.find(
    (wt) => wt.id === activeRepo.activeWorktreeId
  );
  const activeFile = openFiles.find((f) => f.filePath === activeFilePath);
  const activeWorktreeAhead = activeWorktree?.aheadBehind.ahead ?? 0;

  // Poll for changed files and auto-open as diff tabs
  useEffect(() => {
    if (!activeWorktree) return;

    const pollDiffs = async () => {
      const unstaged = await grove.getDiffFiles({ worktreePath: activeWorktree.path, staged: false });
      const staged = await grove.getDiffFiles({ worktreePath: activeWorktree.path, staged: true });
      const allChanged = [...staged, ...unstaged.filter((u) => !staged.some((s) => s.filePath === u.filePath))];

      for (const file of allChanged) {
        const fullPath = `${activeWorktree.path}/${file.filePath}`;
        const alreadyOpen = openFiles.some((f) => f.filePath === fullPath && f.isDiff);
        if (alreadyOpen) continue;

        try {
          const diff = await grove.getFileDiff({ worktreePath: activeWorktree.path, filePath: file.filePath, staged: false });
          setOpenFiles((prev) => {
            if (prev.some((f) => f.filePath === fullPath && f.isDiff)) return prev;
            return [
              ...prev,
              {
                filePath: fullPath,
                contents: diff.modified,
                language: diff.language,
                dirty: false,
                savedContents: diff.modified,
                isDiff: true,
                originalContents: diff.original
              }
            ];
          });
        } catch {
          // File might be binary or deleted
        }
      }

      // Remove diff tabs for files that are no longer changed
      const changedPaths = new Set(allChanged.map((f) => `${activeWorktree.path}/${f.filePath}`));
      setOpenFiles((prev) => prev.filter((f) => !f.isDiff || changedPaths.has(f.filePath)));
    };

    pollDiffs();
    const interval = setInterval(pollDiffs, 3000);
    return () => clearInterval(interval);
  }, [activeWorktree?.path, activeWorktree?.changedFiles]);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "1") {
        e.preventDefault();
        setSidebarPanel((c) => (c === "files" ? null : "files"));
      } else if (meta && e.key === "2") {
        e.preventDefault();
        setSidebarPanel((c) => (c === "worktrees" ? null : "worktrees"));
      } else if (meta && e.key === "3") {
        e.preventDefault();
        setShowCommitBar((c) => !c);
      } else if (meta && e.key === "j") {
        e.preventDefault();
        setShowTerminal((c) => !c);
      } else if (meta && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setSidebarPanel("worktrees");
      } else if (meta && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setShowCommitBar((c) => !c);
      } else if (meta && e.key === "b") {
        e.preventDefault();
        setSidebarPanel((c) => {
          if (c === null) return "files";
          if (c === "files") return "worktrees";
          return null;
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Handlers ──
  const handleOpenRepo = async () => {
    const result = await grove.openRepoDialog();
    if (result.canceled || !result.path) return;
    const snapshot = await grove.openRepo({ path: result.path });
    setSnapshot(snapshot);
  };

  const handleFileSelect = useCallback(async (filePath: string) => {
    const existing = openFiles.find((f) => f.filePath === filePath);
    if (existing) {
      setActiveFilePath(filePath);
      return;
    }

    const { contents, language } = await grove.readFile({ filePath });
    setOpenFiles((prev) => [
      ...prev,
      { filePath, contents, language, dirty: false, savedContents: contents }
    ]);
    setActiveFilePath(filePath);
  }, [openFiles]);

  const handleCloseTab = useCallback((filePath: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.filePath !== filePath));
    if (activeFilePath === filePath) {
      setActiveFilePath((prev) => {
        const remaining = openFiles.filter((f) => f.filePath !== filePath);
        return remaining[remaining.length - 1]?.filePath;
      });
    }
  }, [activeFilePath, openFiles]);

  const handleEditorChange = useCallback((value: string) => {
    if (!activeFilePath) return;

    setOpenFiles((prev) =>
      prev.map((f) =>
        f.filePath === activeFilePath
          ? { ...f, contents: value, dirty: value !== f.savedContents }
          : f
      )
    );

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await grove.writeFile({ filePath: activeFilePath, contents: value });
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.filePath === activeFilePath
            ? { ...f, dirty: false, savedContents: value }
            : f
        )
      );
    }, 2000);
  }, [activeFilePath]);

  const handleTerminalResize = useCallback((delta: number) => {
    setTerminalHeight((h) => Math.max(80, Math.min(400, h + delta)));
  }, []);

  const handleClaudePanelResize = useCallback((delta: number) => {
    setClaudePanelWidth((w) => Math.max(280, Math.min(800, w + delta)));
  }, []);

  const handleRun = useCallback(async (worktreePath: string) => {
    const result = await grove.detectRunCommand({ worktreePath });
    if (!result.command) return;

    // Open terminal
    setShowTerminal(true);

    // Get or create the terminal session via IPC
    const { terminalId } = await grove.terminalCreate({ worktreePath });

    // Small delay for shell prompt to appear, then send the command
    setTimeout(() => {
      grove.terminalWrite({ terminalId, data: result.command + "\n" });
    }, 300);

    // Open browser for web projects after server starts
    if (result.opensUrl) {
      setTimeout(() => {
        grove.openExternal(result.opensUrl!);
      }, 5000);
    }
  }, []);

  const handlePush = useCallback(async (worktreePath: string) => {
    await grove.push({ worktreePath });
    const snapshot = await grove.refresh();
    setSnapshot(snapshot);
  }, [setSnapshot]);

  const handlePull = useCallback(async (worktreePath: string) => {
    await grove.pull({ worktreePath });
    const snapshot = await grove.refresh();
    setSnapshot(snapshot);
  }, [setSnapshot]);

  const tabs: TabInfo[] = openFiles.map((f) => ({
    filePath: f.filePath,
    label: (f.isDiff ? "M " : "") + (f.filePath.split("/").pop() ?? f.filePath),
    dirty: f.dirty,
    language: f.language
  }));

  // ── Activity Bar Config ──
  const activityItems = [
    {
      id: "files" as const,
      title: "Files (Cmd+1)",
      active: sidebarPanel === "files",
      onClick: () => setSidebarPanel((c) => (c === "files" ? null : "files")),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
      )
    },
    {
      id: "worktrees" as const,
      title: "Worktrees (Cmd+2)",
      active: sidebarPanel === "worktrees",
      badge: activeRepo?.worktrees.length,
      onClick: () => setSidebarPanel((c) => (c === "worktrees" ? null : "worktrees")),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Z" />
        </svg>
      )
    },
    {
      id: "diff" as const,
      title: "Commit (Cmd+3)",
      active: showCommitBar,
      badge: activeWorktree?.changedFiles,
      onClick: () => setShowCommitBar((c) => !c),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      )
    },
    {
      id: "terminal" as const,
      title: "Terminal (Cmd+J)",
      active: showTerminal,
      onClick: () => setShowTerminal((c) => !c),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <div className="flex flex-1 overflow-hidden">
      {/* Activity Bar (40px) */}
      <div className="flex w-10 flex-col items-center gap-1 border-r border-zinc-800 bg-zinc-950 pt-2">
        {activityItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`relative flex h-8 w-8 items-center justify-center rounded transition-colors ${
              item.active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
            }`}
            title={item.title}
          >
            {item.icon}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={handleOpenRepo}
          className="mb-2 flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
          title="Open Repository"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
        </button>
      </div>

      {/* Sidebar Overlay (200px) */}
      {sidebarPanel && (
        <div className="w-52 border-r border-zinc-800 bg-zinc-950">
          {sidebarPanel === "worktrees" && activeRepo && (
            <BranchList
              repo={activeRepo}
              onRun={handleRun}
              onPush={handlePush}
              onPull={handlePull}
            />
          )}
          {sidebarPanel === "worktrees" && !activeRepo && (
            <div className="flex h-full items-center justify-center p-4">
              <button
                onClick={handleOpenRepo}
                className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                Open Repository
              </button>
            </div>
          )}
          {sidebarPanel === "files" && activeWorktree && (
            <FileTree
              rootPath={activeWorktree.path}
              onFileSelect={handleFileSelect}
              activeFilePath={activeFilePath}
            />
          )}
          {sidebarPanel === "files" && !activeWorktree && (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-zinc-600">No worktree selected</span>
            </div>
          )}
        </div>
      )}

      {/* Center: Editor + Terminal Drawer */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Commit Bar */}
        {activeWorktree && ((activeWorktree.changedFiles ?? 0) > 0 || activeWorktreeAhead > 0 || showCommitBar) && (
          <DiffToolbar
            showStaged={false}
            onToggleStaged={() => {}}
            onCommit={async (message) => {
              await grove.commit({ worktreePath: activeWorktree.path, message });
              const snapshot = await grove.refresh();
              setSnapshot(snapshot);
            }}
            onGenerateMessage={async () => {
              const { message } = await grove.generateCommitMessage({ worktreePath: activeWorktree.path });
              return message;
            }}
            onPush={async () => {
              await grove.push({ worktreePath: activeWorktree.path });
              const snapshot = await grove.refresh();
              setSnapshot(snapshot);
            }}
            hasChanges={(activeWorktree.changedFiles ?? 0) > 0}
            aheadCount={activeWorktreeAhead}
          />
        )}

        {/* Tab Bar */}
        <EditorTabs
          tabs={tabs}
          activeFilePath={activeFilePath}
          onSelectTab={setActiveFilePath}
          onCloseTab={handleCloseTab}
        />

        {/* Editor / Diff Area */}
        <div className="flex-1 overflow-hidden">
          {activeFile?.isDiff && activeFile.originalContents !== undefined ? (
            <DiffViewer
              original={activeFile.originalContents}
              modified={activeFile.contents}
              language={activeFile.language}
              filePath={activeFile.filePath}
            />
          ) : activeFile ? (
            <CodeEditor
              contents={activeFile.contents}
              language={activeFile.language}
              filePath={activeFile.filePath}
              onChange={handleEditorChange}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h1 className="mb-2 text-2xl font-semibold text-zinc-200">Grove</h1>
                <p className="text-sm text-zinc-500">Git Worktree IDE</p>
                {!activeRepo ? (
                  <button
                    onClick={handleOpenRepo}
                    className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Open Repository
                  </button>
                ) : (
                  <div className="mt-6 text-xs text-zinc-500">
                    <p className="mb-2">{activeRepo.repo.name} — {activeRepo.worktrees.length} worktree{activeRepo.worktrees.length !== 1 ? "s" : ""}</p>
                    <div className="flex flex-col gap-1 text-zinc-600">
                      <span>Cmd+1 File tree</span>
                      <span>Cmd+2 Worktrees</span>
                      <span>Cmd+3 Diff</span>
                      <span>Cmd+J Terminal</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Terminal Drawer (shell only) */}
        {showTerminal && activeWorktree && (
          <>
            <ResizeHandle onResize={handleTerminalResize} />
            <div style={{ height: terminalHeight }} className="overflow-hidden bg-zinc-950">
              <TerminalPanel worktreePath={activeWorktree.path} />
            </div>
          </>
        )}
      </div>

      {/* Right Panel: Claude Chat (always visible when worktree active) */}
      {activeWorktree && (
        <>
          <HorizontalResizeHandle onResize={handleClaudePanelResize} />
          <div style={{ width: claudePanelWidth }} className="flex flex-shrink-0 flex-col bg-zinc-950">
            <div className="flex h-8 items-center border-b border-zinc-800 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Claude Code
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel worktreePath={activeWorktree.path} />
            </div>
          </div>
        </>
      )}

      </div>{/* end content row */}

      {/* Status Bar */}
      <div className="flex h-6 flex-shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {activeRepo ? activeRepo.repo.name : "No repo"}
          </span>
          {activeWorktree && (
            <span className="text-xs text-zinc-500">
              {activeWorktree.branch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeFile?.dirty && (
            <span className="text-xs text-blue-400">Saving...</span>
          )}
          {activeFile && (
            <span className="text-xs text-zinc-600">{activeFile.language}</span>
          )}
          <span className="text-xs text-zinc-600">Grove v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
