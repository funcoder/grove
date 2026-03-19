import { readFile, access } from "node:fs/promises";
import path from "node:path";

interface RunCommand {
  command: string;
  label: string;
  source: "detected" | "ai";
  opensUrl?: string;
}

export class RunDetector {
  async detect(worktreePath: string): Promise<RunCommand | null> {
    // Try each detector in order of priority
    const detectors = [
      () => this.detectNode(worktreePath),
      () => this.detectRust(worktreePath),
      () => this.detectGo(worktreePath),
      () => this.detectPython(worktreePath),
      () => this.detectDotnet(worktreePath),
      () => this.detectSwift(worktreePath),
      () => this.detectRuby(worktreePath),
      () => this.detectMake(worktreePath)
    ];

    for (const detector of detectors) {
      const result = await detector();
      if (result) return result;
    }

    return null;
  }

  private async detectNode(worktreePath: string): Promise<RunCommand | null> {
    const pkgPath = path.join(worktreePath, "package.json");

    try {
      const raw = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const scripts = pkg.scripts ?? {};

      // Detect package manager
      const pm = await this.detectPackageManager(worktreePath);

      // Priority order for dev commands
      const webScripts = new Set(["dev", "start", "serve", "develop"]);
      const devScripts = ["dev", "start", "serve", "develop", "watch"];
      for (const script of devScripts) {
        if (scripts[script]) {
          const scriptCmd = scripts[script] as string;
          const isWeb = webScripts.has(script);

          // Try to detect port from script content
          let port = "3000";
          const portMatch = scriptCmd.match(/--port\s+(\d+)|:(\d{4})\b|-p\s+(\d+)/);
          if (portMatch) {
            port = portMatch[1] ?? portMatch[2] ?? portMatch[3] ?? "3000";
          }
          if (scriptCmd.includes("vite") || scriptCmd.includes("next")) port = "3000";
          if (scriptCmd.includes("5173")) port = "5173";

          return {
            command: `${pm} ${script === "start" ? "start" : `run ${script}`}`,
            label: script,
            source: "detected",
            opensUrl: isWeb ? `http://localhost:${port}` : undefined
          };
        }
      }

      // Fallback: if there's a main entry, run it directly
      if (pkg.main) {
        return {
          command: `node ${pkg.main}`,
          label: "node",
          source: "detected"
        };
      }
    } catch {
      // No package.json
    }

    return null;
  }

  private async detectPackageManager(worktreePath: string): Promise<string> {
    const checks: [string, string][] = [
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "yarn"],
      ["bun.lockb", "bun"],
      ["package-lock.json", "npm"]
    ];

    for (const [lockfile, pm] of checks) {
      try {
        await access(path.join(worktreePath, lockfile));
        return pm;
      } catch {
        // Not found
      }
    }

    return "npm";
  }

  private async detectRust(worktreePath: string): Promise<RunCommand | null> {
    try {
      await access(path.join(worktreePath, "Cargo.toml"));
      return { command: "cargo run", label: "cargo", source: "detected" };
    } catch {
      return null;
    }
  }

  private async detectGo(worktreePath: string): Promise<RunCommand | null> {
    try {
      await access(path.join(worktreePath, "go.mod"));
      return { command: "go run .", label: "go", source: "detected" };
    } catch {
      return null;
    }
  }

  private async detectPython(worktreePath: string): Promise<RunCommand | null> {
    const pyFiles: [string, string][] = [
      ["pyproject.toml", "python -m $(basename $(pwd))"],
      ["setup.py", "python setup.py"],
      ["manage.py", "python manage.py runserver"],
      ["app.py", "python app.py"],
      ["main.py", "python main.py"]
    ];

    for (const [file, command] of pyFiles) {
      try {
        await access(path.join(worktreePath, file));
        return { command, label: "python", source: "detected" };
      } catch {
        // Not found
      }
    }

    return null;
  }

  private async detectDotnet(worktreePath: string): Promise<RunCommand | null> {
    try {
      const entries = await import("node:fs/promises").then((fs) =>
        fs.readdir(worktreePath)
      );
      const hasCsproj = entries.some((e) => e.endsWith(".csproj"));
      const hasSln = entries.some((e) => e.endsWith(".sln"));

      if (hasCsproj || hasSln) {
        return { command: "dotnet run", label: "dotnet", source: "detected" };
      }
    } catch {
      // Error reading directory
    }

    return null;
  }

  private async detectSwift(worktreePath: string): Promise<RunCommand | null> {
    try {
      await access(path.join(worktreePath, "Package.swift"));
      return { command: "swift run", label: "swift", source: "detected" };
    } catch {
      return null;
    }
  }

  private async detectRuby(worktreePath: string): Promise<RunCommand | null> {
    try {
      await access(path.join(worktreePath, "Gemfile"));
      try {
        await access(path.join(worktreePath, "bin/dev"));
        return { command: "bin/dev", label: "rails", source: "detected", opensUrl: "http://localhost:3000" };
      } catch {
        // No bin/dev
      }
      try {
        await access(path.join(worktreePath, "config.ru"));
        return { command: "bundle exec rails server", label: "rails", source: "detected", opensUrl: "http://localhost:3000" };
      } catch {
        // Not rails
      }
      return { command: "bundle exec ruby", label: "ruby", source: "detected" };
    } catch {
      return null;
    }
  }

  private async detectMake(worktreePath: string): Promise<RunCommand | null> {
    try {
      await access(path.join(worktreePath, "Makefile"));
      return { command: "make", label: "make", source: "detected" };
    } catch {
      return null;
    }
  }
}
