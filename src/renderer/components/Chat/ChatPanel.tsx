import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import type { ClaudeChatEvent } from "../../../main/ipc/contracts";
import { grove } from "../../lib/desktop-api";
import {
  getChatState,
  setChatState,
  clearChatState,
  type ChatState,
  type ChatMessage,
  type ActivityItem
} from "../../lib/chat-store";
import { ChatMessageBubble } from "./ChatMessageBubble";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePrompt, setActivePrompt] = useState("");
  const [activeResult, setActiveResult] = useState("");
  const [activeActivity, setActiveActivity] = useState<ActivityItem[]>([]);
  const [resultStreaming, setResultStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [planMode, setPlanMode] = useState(() => {
    try { return localStorage.getItem("grove:plan-mode") === "true"; } catch { return false; }
  });
  const [activityOpen, setActivityOpen] = useState(true);
  const activityEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevWorktreeRef = useRef<string>(worktreePath);
  const stateRef = useRef<ChatState>({
    sessionId: null,
    messages: [],
    activePrompt: "",
    activeResult: "",
    activeActivity: [],
    streaming: false,
    resultStreaming: false
  });

  // Keep ref in sync
  stateRef.current = {
    sessionId,
    messages,
    activePrompt,
    activeResult,
    activeActivity,
    streaming,
    resultStreaming
  };

  // Save previous worktree state + load new worktree state on switch
  useEffect(() => {
    const prevPath = prevWorktreeRef.current;

    if (prevPath !== worktreePath) {
      setChatState(prevPath, stateRef.current);
    }

    const stored = getChatState(worktreePath);
    setMessages(stored.messages);
    setActivePrompt(stored.activePrompt);
    setActiveResult(stored.activeResult);
    setActiveActivity(stored.activeActivity);
    setResultStreaming(stored.resultStreaming);
    setStreaming(stored.streaming);
    setSessionId(stored.sessionId);
    setInput("");

    prevWorktreeRef.current = worktreePath;

    if (!stored.sessionId) {
      grove.claudeChatInit({ worktreePath }).then(({ sessionId: id }) => {
        setSessionId(id);
      });
    }
  }, [worktreePath]);

  // Save on unmount
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
        setActiveResult((prev) => prev + event.content);
      } else if (event.type === "tool_use") {
        setActiveActivity((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "tool",
            toolName: event.toolName,
            detail: event.content
          }
        ]);
      } else if (event.type === "tool_result") {
        setActiveActivity((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "tool") {
            return [...prev.slice(0, -1), { ...last, result: event.content }];
          }
          return prev;
        });
      } else if (event.type === "error") {
        setActiveActivity((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "error",
            detail: event.content
          }
        ]);
      } else if (event.type === "done") {
        // Finalize the active message into history using ref for current values
        const { activePrompt: prompt, activeResult: result, activeActivity: activity } = stateRef.current;
        if (prompt || result) {
          const completed: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            prompt,
            result,
            activity,
            timestamp: Date.now()
          };
          // Guard: don't add if last message has same prompt (prevents duplicates)
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.prompt === prompt && last.result.slice(0, 100) === result.slice(0, 100)) {
              return prev;
            }
            return [...prev, completed];
          });
        }
        setActivePrompt("");
        setActiveResult("");
        setActiveActivity([]);
        setStreaming(false);
        setResultStreaming(false);
      }
    });

    return unsub;
  }, [sessionId]);

  // Periodic save
  useEffect(() => {
    const interval = setInterval(() => {
      setChatState(worktreePath, stateRef.current);
    }, 2000);
    return () => clearInterval(interval);
  }, [worktreePath]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeResult, activeActivity, messages]);

  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId || streaming) return;

    // In plan mode, wrap the prompt so Claude plans first
    const actualMessage = planMode
      ? `${message}\n\nIMPORTANT: Do NOT implement anything yet. First create a detailed plan with numbered steps. List the files you'll change and what you'll do in each. Then STOP and wait for my explicit approval before writing any code.`
      : message;

    setInput("");
    setActivePrompt(message); // Show the original prompt in UI
    setActiveResult("");
    setActiveActivity([]);
    setStreaming(true);
    setResultStreaming(false);

    await grove.claudeChatSend({ sessionId, message: actualMessage });
  }, [sessionId, streaming, planMode]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    await sendMessage(input.trim());
  }, [input, sendMessage]);

  const handleCancel = useCallback(() => {
    if (!sessionId) return;
    grove.claudeChatCancel({ sessionId });
  }, [sessionId]);

  const handleTogglePlanMode = useCallback(() => {
    const next = !planMode;
    setPlanMode(next);
    try { localStorage.setItem("grove:plan-mode", String(next)); } catch { /* ignore */ }
  }, [planMode]);

  const handleNewSession = useCallback(async () => {
    if (!worktreePath) return;
    // Cancel any active work
    if (sessionId && streaming) {
      grove.claudeChatCancel({ sessionId });
    }
    clearChatState(worktreePath);
    setMessages([]);
    setActivePrompt("");
    setActiveResult("");
    setActiveActivity([]);
    setStreaming(false);
    setResultStreaming(false);

    const { sessionId: newId } = await grove.claudeChatReset({ worktreePath });
    setSessionId(newId);
  }, [worktreePath, sessionId, streaming]);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);

  // Build unique prompt list from messages (most recent first)
  const promptHistory = [...messages]
    .reverse()
    .map((m) => m.prompt)
    .filter((p, i, arr) => p && arr.indexOf(p) === i);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      setHistoryIndex(-1);
    } else if (e.key === "ArrowUp" && !input && promptHistory.length > 0) {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, promptHistory.length - 1);
      setHistoryIndex(next);
      setInput(promptHistory[next]);
    } else if (e.key === "ArrowDown" && historyIndex >= 0) {
      e.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next >= 0 ? promptHistory[next] : "");
    } else if (e.key === "Escape" && showHistory) {
      setShowHistory(false);
    }
  };

  const handleSelectHistory = (prompt: string) => {
    setInput(prompt);
    setShowHistory(false);
    setHistoryIndex(-1);
  };

  const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-4 text-base font-bold text-zinc-100">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-bold text-zinc-100">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-zinc-200">{children}</h3>,
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 leading-relaxed">{children}</p>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 ml-4 list-decimal space-y-2">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => {
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

  const hasHistory = messages.length > 0;
  const hasActiveMessage = activePrompt || streaming;
  const isEmpty = !hasHistory && !hasActiveMessage;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header with Plan Mode + New Session */}
      {(hasHistory || hasActiveMessage) && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlanMode}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
                planMode
                  ? "bg-amber-600/20 text-amber-400"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
              title={planMode ? "Plan mode ON — Claude will plan before coding" : "Plan mode OFF — Claude will code directly"}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              Plan
            </button>
            <button
              onClick={handleNewSession}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="Start a new conversation"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          </div>
        </div>
      )}

      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="text-center">
              <p className="text-sm text-zinc-500">Ask Claude about this worktree</p>
              <p className="mt-1 text-xs text-zinc-600">Has full context of the codebase</p>
            </div>
            <button
              onClick={handleTogglePlanMode}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                planMode
                  ? "bg-amber-600/20 text-amber-400 border border-amber-600/30"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              {planMode ? "Plan Mode ON" : "Plan Mode OFF"}
            </button>
          </div>
        ) : (
          <>
            {/* History */}
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                markdownComponents={markdownComponents as Record<string, React.ComponentType<Record<string, unknown>>>}
              />
            ))}

            {/* Active/streaming message */}
            {hasActiveMessage && (
              <div className="border-b border-zinc-800/50 pb-3 mb-3 last:border-0">
                {/* User prompt */}
                <div className="bg-zinc-900/30 rounded-md px-3 py-2 mb-2">
                  <p className="text-sm text-zinc-400">{activePrompt}</p>
                </div>

                {/* Streaming result */}
                {activeResult ? (
                  <div className="text-sm text-zinc-200 px-1">
                    <Markdown components={markdownComponents}>{activeResult}</Markdown>
                    {resultStreaming && (
                      <span className="inline-block h-4 w-1.5 animate-pulse bg-blue-400" />
                    )}
                  </div>
                ) : streaming ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
                    <span className="text-xs text-zinc-500">
                      {activeActivity.length > 0
                        ? `Researching... (${activeActivity.length} step${activeActivity.length !== 1 ? "s" : ""})`
                        : "Starting..."}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {/* Current activity indicator */}
      {streaming && activeActivity.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              {activeActivity[activeActivity.length - 1]?.toolName ?? "Working"}
            </span>
            <span className="truncate text-xs font-mono text-zinc-500">
              {activeActivity[activeActivity.length - 1]?.detail ?? ""}
            </span>
          </div>
        </div>
      )}

      {/* Activity feed — collapsible */}
      {activeActivity.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800">
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900/50"
          >
            <span className="font-semibold uppercase tracking-wider">Activity</span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
                {activeActivity.length}
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
              {activeActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-4 py-1 text-xs border-b border-zinc-800/30 last:border-0"
                >
                  {item.type === "tool" ? (
                    <>
                      <span className="text-amber-400">-</span>
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

      {/* Plan mode indicator */}
      {planMode && !streaming && (
        <div className="flex-shrink-0 flex items-center gap-1.5 border-t border-amber-600/20 bg-amber-600/5 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[10px] text-amber-400/80">Plan mode — Claude will plan before coding</span>
        </div>
      )}

      {/* Prompt history dropdown */}
      {showHistory && promptHistory.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">Prompt History</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400"
            >
              Close
            </button>
          </div>
          {promptHistory.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSelectHistory(prompt)}
              className="flex w-full items-center gap-2 border-t border-zinc-800/30 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              <svg className="h-3 w-3 flex-shrink-0 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="truncate">{prompt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setHistoryIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder={promptHistory.length > 0 ? "Ask Claude... (↑ for history)" : "Ask Claude..."}
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-200 outline-none focus:border-blue-600 placeholder:text-zinc-500"
              style={{ maxHeight: 120 }}
              disabled={streaming}
            />
            {promptHistory.length > 0 && !streaming && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded text-zinc-600 hover:text-zinc-300 ${showHistory ? "text-blue-400" : ""}`}
                title="Prompt history"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </button>
            )}
          </div>
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
