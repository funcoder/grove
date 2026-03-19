import * as pty from "node-pty";
import { randomUUID } from "node:crypto";

const MAX_BUFFER_SIZE = 100_000;

export interface ClaudeSession {
  id: string;
  pty: pty.IPty;
  worktreePath: string;
  outputBuffer: string[];
  bufferSize: number;
}

export type ClaudeOutputHandler = (sessionId: string, data: string) => void;

export class ClaudeCodeService {
  private readonly sessions = new Map<string, ClaudeSession>();
  private readonly sessionsByWorktree = new Map<string, string>();
  private readonly onOutput: ClaudeOutputHandler;

  constructor(onOutput: ClaudeOutputHandler) {
    this.onOutput = onOutput;
  }

  getOrCreate(worktreePath: string): { sessionId: string; existing: boolean } {
    const existingId = this.sessionsByWorktree.get(worktreePath);
    if (existingId && this.sessions.has(existingId)) {
      return { sessionId: existingId, existing: true };
    }

    const id = randomUUID().slice(0, 8);

    const env = { ...process.env } as Record<string, string>;
    delete env.CLAUDECODE;

    const term = pty.spawn("claude", ["--dangerously-skip-permissions"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: worktreePath,
      env
    });

    const session: ClaudeSession = {
      id,
      pty: term,
      worktreePath,
      outputBuffer: [],
      bufferSize: 0
    };

    term.onData((data) => {
      this.appendBuffer(session, data);
      this.onOutput(id, data);
    });

    this.sessions.set(id, session);
    this.sessionsByWorktree.set(worktreePath, id);
    return { sessionId: id, existing: false };
  }

  getBufferedOutput(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return "";
    return session.outputBuffer.join("");
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Claude session ${sessionId} not found`);
    session.pty.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Claude session ${sessionId} not found`);
    session.pty.resize(cols, rows);
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(sessionId);
    this.sessionsByWorktree.delete(session.worktreePath);
  }

  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroy(id);
    }
  }

  private appendBuffer(session: ClaudeSession, data: string): void {
    session.outputBuffer.push(data);
    session.bufferSize += data.length;

    while (session.bufferSize > MAX_BUFFER_SIZE && session.outputBuffer.length > 1) {
      const removed = session.outputBuffer.shift();
      if (removed) session.bufferSize -= removed.length;
    }
  }
}
