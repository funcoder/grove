import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import type { ClaudeChatEvent } from "../../../main/ipc/contracts";
import { grove } from "../../lib/desktop-api";
import { getChatState, setChatState, type ChatState } from "../../lib/chat-store";

interface ActivityItem {
  id: string;
  type: "tool" | "error";
  toolName?: string;
  detail: string;
  result?: string;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

interface Props {
  worktreePath: string;
}

export function ChatPanel({ worktreePath }: Props) {
  const [result, setResult] = useState("");
  const [resultStreaming, setResultStreaming] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const activityEndRef = useRef<HTMLDivElement>(null);
  const prevWorktreeRef = useRef<string>(worktreePath);
  const stateRef = useRef({ result: "", resultStreaming: false, activity: [] as ActivityItem[], prompt: "", streaming: false, sessionId: null as string | null });

  // Keep ref in sync with state
  stateRef.current = { result, resultStreaming, activity, prompt, streaming, sessionId };

  // Save previous worktree state + load new worktree state on switch
  useEffect(() => {
    const prevPath = prevWorktreeRef.current;

    // Save previous worktree's state
    if (prevPath !== worktreePath) {
      setChatState(prevPath, stateRef.current);
    }

    // Load new worktree's state
    const stored = getChatState(worktreePath);
    setResult(stored.result);
    setResultStreaming(stored.resultStreaming);
    setActivity(stored.activity);
    setPrompt(stored.prompt);
    setStreaming(stored.streaming);
    setSessionId(stored.sessionId);
    setInput("");

    prevWorktreeRef.current = worktreePath;

    // Init session if none exists for this worktree
    if (!stored.sessionId) {
      grove.claudeChatInit({ worktreePath }).then(({ sessionId: id }) => {
        setSessionId(id);
      });
    }
  }, [worktreePath]);

  // Save current state on unmount
  useEffect(() => {
    return () => {
      setChatState(prevWorktreeRef.current, stateRef.current);
    };
  }, []);

  // Subscribe to chat events
  useEffect(() => {
    const unsub = grove.onClaudeChatEvent((event: ClaudeChatEvent) => {
      if (event.sessionId !== sessionId) return;

      if (event.type === "text") {
        setResultStreaming(true);
        setResult((prev) => prev + event.content);
      } else if (event.type === "tool_use") {
        setActivity((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "tool",
            toolName: event.toolName,
            detail: event.content
          }
        ]);
      } else if (event.type === "tool_result") {
        setActivity((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "tool") {
            return [
              ...prev.slice(0, -1),
              { ...last, result: event.content }
            ];
          }
          return prev;
        });
      } else if (event.type === "error") {
        setActivity((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "error",
            detail: event.content
          }
        ]);
      } else if (event.type === "done") {
        setStreaming(false);
        setResultStreaming(false);
      }
    });

    return unsub;
  }, [sessionId]);

  // Periodic save so streaming results aren't lost on switch
  useEffect(() => {
    const interval = setInterval(() => {
      setChatState(worktreePath, stateRef.current);
    }, 2000);
    return () => clearInterval(interval);
  }, [worktreePath]);

  // Auto-scroll activity
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity]);

  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId || streaming) return;

    setPrompt(message);
    setInput("");
    setResult("");
    setActivity([]);
    setStreaming(true);
    setResultStreaming(false);

    await grove.claudeChatSend({ sessionId, message });
  }, [sessionId, streaming]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    await sendMessage(input.trim());
  }, [input, sendMessage]);

  const handleCancel = useCallback(() => {
    if (!sessionId) return;
    grove.claudeChatCancel({ sessionId });
  }, [sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-4 text-base font-bold text-zinc-100">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-bold text-zinc-100">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-zinc-200">{children}</h3>,
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 leading-relaxed">{children}</p>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 ml-4 list-decimal space-y-2">{children}</ol>,
    li: ({ node, children }: { node?: { position?: { start?: { line?: number } } }; children?: React.ReactNode }) => {
      // Check if parent is an ordered list by looking at the node context
      const textContent = extractText(children);
      const isActionable = textContent.length > 10;

      if (isActionable) {
        return (
          <li className="text-zinc-300 group">
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1">{children}</div>
              <button
                onClick={() => sendMessage(`Implement this: ${textContent}`)}
                disabled={streaming}
                className="mt-0.5 flex-shrink-0 hidden group-hover:flex items-center gap-1 rounded bg-blue-600/80 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                title="Ask Claude to build this"
              >
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Build
              </button>
            </div>
          </li>
        );
      }

      return <li className="text-zinc-300">{children}</li>;
    },
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <pre className="my-2 overflow-x-auto rounded-md bg-zinc-900 border border-zinc-800 p-3">
            <code className="text-xs text-zinc-300">{children}</code>
          </pre>
        );
      }
      return (
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-amber-300">{children}</code>
      );
    },
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} className="text-blue-400 underline" target="_blank" rel="noreferrer">{children}</a>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 text-zinc-400">{children}</blockquote>
    ),
    hr: () => <hr className="my-3 border-zinc-800" />
  };

  // Empty state
  if (!prompt && !streaming) {
    return (
      <div className="flex h-full flex-col bg-zinc-950">
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm text-zinc-500">Ask Claude about this worktree</p>
            <p className="mt-1 text-xs text-zinc-600">Has full context of the codebase</p>
          </div>
        </div>
        <div className="border-t border-zinc-800 px-3 py-2">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude..."
              rows={2}
              className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-600 placeholder:text-zinc-500"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !sessionId}
              className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Prompt */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/30 px-4 py-2.5">
        <p className="text-sm text-zinc-400">{prompt}</p>
      </div>

      {/* Result Panel — scrolls from top */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {result ? (
          <div className="text-sm text-zinc-200">
            <Markdown components={markdownComponents}>{result}</Markdown>
            {resultStreaming && (
              <span className="inline-block h-4 w-1.5 animate-pulse bg-blue-400" />
            )}
          </div>
        ) : streaming ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
            <span className="text-xs text-zinc-500">
              {activity.length > 0
                ? `Researching... (${activity.length} step${activity.length !== 1 ? "s" : ""})`
                : "Starting..."}
            </span>
          </div>
        ) : null}
      </div>

      {/* Current Activity Indicator */}
      {streaming && activity.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              {activity[activity.length - 1]?.toolName ?? "Working"}
            </span>
            <span className="truncate text-xs font-mono text-zinc-500">
              {activity[activity.length - 1]?.detail ?? ""}
            </span>
          </div>
        </div>
      )}

      {/* Activity Feed — collapsible bottom section */}
      {activity.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800">
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900/50"
          >
            <span className="font-semibold uppercase tracking-wider">
              Activity
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
                {activity.length}
              </span>
              <svg
                className={`h-3 w-3 transition-transform ${activityOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          {activityOpen && (
            <div className="max-h-40 overflow-y-auto border-t border-zinc-800/50">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-4 py-1 text-xs border-b border-zinc-800/30 last:border-0"
                >
                  {item.type === "tool" ? (
                    <>
                      <span className="text-amber-400">⚡</span>
                      <span className="font-semibold text-zinc-400">{item.toolName}</span>
                      <span className="truncate font-mono text-zinc-600">{item.detail}</span>
                      {item.result && (
                        <span className="ml-auto flex-shrink-0 text-emerald-600">done</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">!</span>
                      <span className="truncate text-red-400">{item.detail}</span>
                    </>
                  )}
                </div>
              ))}
              <div ref={activityEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-600 placeholder:text-zinc-500"
            style={{ maxHeight: 120 }}
            disabled={streaming}
          />
          {streaming ? (
            <button
              onClick={handleCancel}
              className="flex-shrink-0 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !sessionId}
              className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
