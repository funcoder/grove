const iconMap: Record<string, { label: string; color: string }> = {
  ".ts": { label: "TS", color: "text-blue-400" },
  ".tsx": { label: "TX", color: "text-blue-300" },
  ".js": { label: "JS", color: "text-yellow-400" },
  ".jsx": { label: "JX", color: "text-yellow-300" },
  ".json": { label: "{}", color: "text-yellow-500" },
  ".css": { label: "#", color: "text-purple-400" },
  ".scss": { label: "#", color: "text-pink-400" },
  ".html": { label: "<>", color: "text-orange-400" },
  ".md": { label: "M", color: "text-zinc-400" },
  ".py": { label: "PY", color: "text-green-400" },
  ".rs": { label: "RS", color: "text-orange-500" },
  ".go": { label: "GO", color: "text-cyan-400" },
  ".rb": { label: "RB", color: "text-red-400" },
  ".cs": { label: "C#", color: "text-green-500" },
  ".swift": { label: "SW", color: "text-orange-400" },
  ".sh": { label: "$", color: "text-green-300" },
  ".bash": { label: "$", color: "text-green-300" },
  ".zsh": { label: "$", color: "text-green-300" },
  ".yaml": { label: "Y", color: "text-red-300" },
  ".yml": { label: "Y", color: "text-red-300" },
  ".toml": { label: "T", color: "text-zinc-400" },
  ".sql": { label: "SQ", color: "text-cyan-300" },
  ".graphql": { label: "GQ", color: "text-pink-400" },
  ".env": { label: "E", color: "text-yellow-600" },
  ".svg": { label: "SV", color: "text-amber-400" },
  ".png": { label: "IM", color: "text-emerald-400" },
  ".jpg": { label: "IM", color: "text-emerald-400" },
  ".jpeg": { label: "IM", color: "text-emerald-400" },
  ".gif": { label: "IM", color: "text-emerald-400" },
  ".xml": { label: "<>", color: "text-orange-300" },
  ".lock": { label: "LK", color: "text-zinc-600" },
  ".bicep": { label: "AZ", color: "text-blue-500" },
  ".mjs": { label: "MJ", color: "text-yellow-400" },
  ".cjs": { label: "CJ", color: "text-yellow-500" },
};

const specialFiles: Record<string, { label: string; color: string }> = {
  "package.json": { label: "{}", color: "text-green-400" },
  "tsconfig.json": { label: "TS", color: "text-blue-400" },
  ".gitignore": { label: "GI", color: "text-zinc-500" },
  "Dockerfile": { label: "DK", color: "text-blue-400" },
  "Makefile": { label: "MK", color: "text-zinc-400" },
  ".eslintrc": { label: "ES", color: "text-purple-400" },
  "vite.config.ts": { label: "VI", color: "text-purple-300" },
};

interface Props {
  fileName: string;
}

export function FileIcon({ fileName }: Props) {
  const special = specialFiles[fileName];
  if (special) {
    return (
      <span className={`inline-flex w-4 justify-center text-[9px] font-bold ${special.color}`}>
        {special.label}
      </span>
    );
  }

  const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";
  const icon = iconMap[ext];

  if (icon) {
    return (
      <span className={`inline-flex w-4 justify-center text-[9px] font-bold ${icon.color}`}>
        {icon.label}
      </span>
    );
  }

  return (
    <span className="inline-flex w-4 justify-center text-[9px] font-bold text-zinc-600">
      --
    </span>
  );
}
