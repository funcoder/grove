import { useState } from "react";

interface Props {
  showStaged: boolean;
  onToggleStaged: () => void;
  onCommit: (message: string) => void;
  onGenerateMessage: () => Promise<string>;
  onPush: () => Promise<void>;
  onPull: () => Promise<void>;
  onCherryPick?: () => void;
  hasChanges: boolean;
  aheadCount: number;
  behindCount: number;
}

export function DiffToolbar({
  showStaged,
  onToggleStaged,
  onCommit,
  onGenerateMessage,
  onPush,
  onPull,
  onCherryPick,
  hasChanges,
  aheadCount,
  behindCount
}: Props) {
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const handleCommit = () => {
    if (!message.trim()) return;
    onCommit(message.trim());
    setMessage("");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const generated = await onGenerateMessage();
      if (generated) setMessage(generated);
    } finally {
      setGenerating(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      await onPush();
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      await onPull();
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
      <div className="flex flex-shrink-0 rounded-md border border-zinc-700 text-xs">
        <button
          onClick={() => !showStaged || onToggleStaged()}
          className={`px-2 py-1 ${!showStaged ? "bg-zinc-700 text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          Unstaged
        </button>
        <button
          onClick={() => showStaged || onToggleStaged()}
          className={`px-2 py-1 ${showStaged ? "bg-zinc-700 text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          Staged
        </button>
      </div>

      {hasChanges && (
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            title="Auto-generate commit message from changes"
          >
            {generating ? "..." : "Generate"}
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message..."
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200 outline-none focus:border-blue-600"
            onKeyDown={(e) => e.key === "Enter" && handleCommit()}
          />
          <button
            onClick={handleCommit}
            disabled={!message.trim()}
            className="flex-shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Commit
          </button>
        </div>
      )}

      <button
        onClick={handlePull}
        disabled={pulling}
        className="flex-shrink-0 rounded-md bg-orange-600 px-3 py-1 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
      >
        {pulling ? "Pulling..." : behindCount > 0 ? `Pull ${behindCount}↓` : "Pull"}
      </button>

      {onCherryPick && (
        <button
          onClick={onCherryPick}
          className="flex-shrink-0 rounded-md bg-purple-600 px-3 py-1 text-sm font-medium text-white hover:bg-purple-500"
          title="Cherry-pick commits from another branch"
        >
          Cherry Pick
        </button>
      )}

      <button
        onClick={handlePush}
        disabled={pushing || aheadCount === 0}
        className="flex-shrink-0 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pushing ? "Pushing..." : aheadCount > 0 ? `Push ${aheadCount}↑` : "Push"}
      </button>
    </div>
  );
}
