import type { TabInfo } from "../../../main/ipc/contracts";

interface Props {
  tabs: TabInfo[];
  activeFilePath?: string;
  onSelectTab: (filePath: string) => void;
  onCloseTab: (filePath: string) => void;
}

export function EditorTabs({ tabs, activeFilePath, onSelectTab, onCloseTab }: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-9 items-center gap-0 border-b border-zinc-800 bg-zinc-950 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.filePath === activeFilePath;
        return (
          <div
            key={tab.filePath}
            className={`group flex h-full items-center gap-1.5 border-r border-zinc-800 px-3 text-sm cursor-pointer ${
              isActive
                ? "bg-zinc-900 text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
            }`}
            onClick={() => onSelectTab(tab.filePath)}
          >
            <span className="truncate max-w-32">{tab.label}</span>
            {tab.dirty && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.filePath);
              }}
              className="ml-1 hidden h-4 w-4 items-center justify-center rounded text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 group-hover:flex"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
