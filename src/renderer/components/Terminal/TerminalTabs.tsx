interface Props {
  activeTab: "shell" | "claude";
  onTabChange: (tab: "shell" | "claude") => void;
}

export function TerminalTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex h-8 items-center gap-0 border-b border-zinc-800 bg-zinc-950">
      <button
        onClick={() => onTabChange("shell")}
        className={`flex h-full items-center px-3 text-xs ${
          activeTab === "shell"
            ? "border-b border-blue-500 text-zinc-200"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Shell
      </button>
      <button
        onClick={() => onTabChange("claude")}
        className={`flex h-full items-center px-3 text-xs ${
          activeTab === "claude"
            ? "border-b border-blue-500 text-zinc-200"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Claude Code
      </button>
    </div>
  );
}
