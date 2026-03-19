import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-electron",
  ".next",
  ".nuxt",
  "build",
  "coverage",
  "__pycache__",
  ".cache",
  ".turbo",
  ".vite"
]);

const IGNORED_FILES = new Set([
  ".DS_Store",
  "Thumbs.db"
]);

export class FileService {
  async readDirectory(dirPath: string, depth = 0, maxDepth = 6): Promise<FileTreeNode[]> {
    if (depth >= maxDepth) return [];

    const entries = await readdir(dirPath, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    const sorted = entries
      .filter((e) => !IGNORED_DIRS.has(e.name) && !IGNORED_FILES.has(e.name) && !e.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children = await this.readDirectory(fullPath, depth + 1, maxDepth);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          children
        });
      } else {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: "file"
        });
      }
    }

    return nodes;
  }

  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, "utf-8");
  }

  async writeFile(filePath: string, contents: string): Promise<void> {
    await writeFile(filePath, contents, "utf-8");
  }

  async getFileSize(filePath: string): Promise<number> {
    const stats = await stat(filePath);
    return stats.size;
  }

  detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescriptreact",
      ".js": "javascript",
      ".jsx": "javascriptreact",
      ".json": "json",
      ".md": "markdown",
      ".css": "css",
      ".scss": "scss",
      ".html": "html",
      ".xml": "xml",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".rb": "ruby",
      ".sh": "shell",
      ".bash": "shell",
      ".zsh": "shell",
      ".sql": "sql",
      ".graphql": "graphql",
      ".toml": "toml",
      ".env": "dotenv",
      ".gitignore": "ignore",
      ".dockerignore": "ignore",
      ".cs": "csharp",
      ".bicep": "bicep",
      ".swift": "swift"
    };

    return langMap[ext] ?? "plaintext";
  }
}
