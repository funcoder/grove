import { useState } from "react";
import Markdown from "react-markdown";
import type { ChatMessage, ActivityItem } from "../../lib/chat-store";

interface Props {
  message: ChatMessage;
  markdownComponents: Record<string, React.ComponentType<Record<string, unknown>>>;
}

export function ChatMessageBubble({ message, markdownComponents }: Props) {
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <div className="border-b border-zinc-800/50 pb-3 mb-3 last:border-0">
      {/* User prompt */}
      <div className="bg-zinc-900/30 rounded-md px-3 py-2 mb-2">
        <p className="text-sm text-zinc-400">{message.prompt}</p>
      </div>

      {/* Assistant response */}
      {message.result && (
        <div className="text-sm text-zinc-200 px-1">
          <Markdown components={markdownComponents}>{message.result}</Markdown>
        </div>
      )}

      {/* Activity summary */}
      {message.activity.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            <svg
              className={`h-2.5 w-2.5 transition-transform ${activityOpen ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span>{message.activity.length} step{message.activity.length !== 1 ? "s" : ""}</span>
          </button>

          {activityOpen && (
            <div className="mt-1 ml-1 border-l border-zinc-800 pl-2">
              {message.activity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  if (item.type === "error") {
    return (
      <div className="flex items-center gap-1.5 py-0.5 text-[10px]">
        <span className="text-red-400">!</span>
        <span className="truncate text-red-400">{item.detail}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-0.5 text-[10px]">
      <span className="text-amber-400/60">-</span>
      <span className="font-semibold text-zinc-500">{item.toolName}</span>
      <span className="truncate font-mono text-zinc-700">{item.detail}</span>
    </div>
  );
}
