import type { DiffFileInfo } from "../../../main/ipc/contracts";

interface Props {
  files: DiffFileInfo[];
  activeFilePath?: string;
  onSelectFile: (filePath: string) => void;
  onStageFile: (filePath: string) => void;
  onUnstageFile: (filePath: string) => void;
  showStaged: boolean;
}

const statusColors: Record<string, string> = {
  added: "text-emerald-400",
  modified: "text-amber-400",
  deleted: "text-red-400",
  renamed: "text-blue-400"
};

const statusLetters: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R"
};

export function DiffFileList({
  files,
  activeFilePath,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  showStaged
}: Props) {
  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-xs text-zinc-500">
          {showStaged ? "No staged changes" : "No unstaged changes"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {files.map((file) => {
        const isActive = file.filePath === activeFilePath;
        const fileName = file.filePath.split("/").pop() ?? file.filePath;

        return (
          <div
            key={file.filePath}
            className={`group flex items-center gap-2 px-3 py-1 cursor-pointer ${
              isActive
                ? "bg-blue-950/40 text-zinc-200"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
            onClick={() => onSelectFile(file.filePath)}
          >
            <span className={`text-xs font-mono ${statusColors[file.status] ?? "text-zinc-400"}`}>
              {statusLetters[file.status] ?? "?"}
            </span>
            <span className="flex-1 truncate text-sm">{fileName}</span>
            <span className="text-xs text-zinc-600">
              {file.additions > 0 && <span className="text-emerald-500">+{file.additions}</span>}
              {file.deletions > 0 && <span className="text-red-400 ml-1">-{file.deletions}</span>}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                showStaged ? onUnstageFile(file.filePath) : onStageFile(file.filePath);
              }}
              className="hidden h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 group-hover:flex"
              title={showStaged ? "Unstage" : "Stage"}
            >
              <span className="text-xs">{showStaged ? "-" : "+"}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
