import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

export interface ChatEvent {
  sessionId: string;
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  content: string;
  toolName?: string;
}

export type ChatEventHandler = (event: ChatEvent) => void;

interface ChatSession {
  id: string;
  worktreePath: string;
  conversationId?: string;
  activeProcess: ChildProcess | null;
  hasEmittedText: boolean;
}

export class ClaudeChatService {
  private readonly sessions = new Map<string, ChatSession>();
  private readonly onEvent: ChatEventHandler;

  constructor(onEvent: ChatEventHandler) {
    this.onEvent = onEvent;
  }

  getOrCreateSession(worktreePath: string): string {
    for (const [id, session] of this.sessions) {
      if (session.worktreePath === worktreePath) return id;
    }

    const id = randomUUID().slice(0, 8);
    this.sessions.set(id, {
      id,
      worktreePath,
      conversationId: undefined,
      activeProcess: null,
      hasEmittedText: false
    });
    return id;
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Chat session ${sessionId} not found`);

    // Kill any active process
    if (session.activeProcess && !session.activeProcess.killed) {
      session.activeProcess.kill();
    }
    session.hasEmittedText = false;

    const args = [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions"
    ];

    // Continue existing conversation
    if (session.conversationId) {
      args.push("--resume", session.conversationId);
    }

    args.push(message);

    const env = { ...process.env } as Record<string, string>;
    delete env.CLAUDECODE;

    const proc = spawn("claude", args, {
      cwd: session.worktreePath,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    session.activeProcess = proc;

    const rl = createInterface({ input: proc.stdout! });

    rl.on("line", (line) => {
      if (!line.trim()) return;

      try {
        const event = JSON.parse(line);
        this.handleStreamEvent(session, event);
      } catch {
        // Non-JSON line, ignore
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.trim()) {
        this.onEvent({
          sessionId: session.id,
          type: "error",
          content: text
        });
      }
    });

    proc.on("close", () => {
      session.activeProcess = null;
      this.onEvent({
        sessionId: session.id,
        type: "done",
        content: ""
      });
    });
  }

  cancelMessage(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.activeProcess || session.activeProcess.killed) return;
    session.activeProcess.kill();
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.activeProcess && !session.activeProcess.killed) {
      session.activeProcess.kill();
    }
    this.sessions.delete(sessionId);
  }

  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroy(id);
    }
  }

  private handleStreamEvent(session: ChatSession, event: Record<string, unknown>): void {
    const type = event.type as string;

    // Capture session/conversation ID from any event
    if (event.session_id && typeof event.session_id === "string") {
      session.conversationId = event.session_id;
    }

    if (type === "system" || type === "rate_limit_event") {
      return;
    }

    if (type === "assistant") {
      const message = event.message as Record<string, unknown> | undefined;
      const content = message?.content as Array<Record<string, unknown>> | undefined;
      if (!content) return;

      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") {
          session.hasEmittedText = true;
          this.onEvent({
            sessionId: session.id,
            type: "text",
            content: block.text
          });
        } else if (block.type === "tool_use" && typeof block.name === "string") {
          const summary = this.summarizeToolInput(block.name, block.input as Record<string, unknown>);
          this.onEvent({
            sessionId: session.id,
            type: "tool_use",
            content: summary,
            toolName: block.name
          });
        }
      }
      return;
    }

    if (type === "user") {
      // Tool result events
      const toolResult = event.tool_use_result as Record<string, unknown> | undefined;
      if (toolResult) {
        const file = toolResult.file as Record<string, unknown> | undefined;
        let resultSummary = "";

        if (file?.filePath) {
          resultSummary = `${file.filePath} (${file.numLines ?? "?"} lines)`;
        } else if (typeof toolResult.type === "string" && toolResult.type === "text") {
          const text = String(
            (event.message as Record<string, unknown>)?.content?.[0 as keyof object] ?? ""
          );
          if (typeof text === "string" && text.length > 0) {
            resultSummary = text.length > 200 ? text.slice(0, 200) + "..." : text;
          }
        }

        if (resultSummary) {
          this.onEvent({
            sessionId: session.id,
            type: "tool_result",
            content: resultSummary
          });
        }
      }
      return;
    }

    if (type === "result") {
      if (!session.hasEmittedText) {
        const result = event.result as string | undefined;
        if (result && typeof result === "string") {
          this.onEvent({
            sessionId: session.id,
            type: "text",
            content: result
          });
        }
      }
      return;
    }
  }

  private summarizeToolInput(name: string, input: Record<string, unknown>): string {
    if (!input) return "";

    switch (name) {
      case "Read":
        return String(input.file_path ?? "").split("/").slice(-2).join("/");
      case "Write":
      case "Edit":
        return String(input.file_path ?? "").split("/").slice(-2).join("/");
      case "Bash":
        return String(input.command ?? "").slice(0, 100);
      case "Grep":
        return `/${input.pattern ?? ""}/ in ${String(input.path ?? ".").split("/").pop()}`;
      case "Glob":
        return String(input.pattern ?? "");
      case "WebSearch":
        return String(input.query ?? "");
      case "WebFetch":
        return String(input.url ?? "").slice(0, 80);
      case "Task":
      case "Agent":
        return String(input.description ?? input.prompt ?? "").slice(0, 80);
      default:
        return Object.values(input).map(String).join(", ").slice(0, 80);
    }
  }
}
