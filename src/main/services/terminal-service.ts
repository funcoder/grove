import * as pty from "node-pty";
import { randomUUID } from "node:crypto";

const MAX_BUFFER_SIZE = 100_000;

export interface TerminalSession {
  id: string;
  pty: pty.IPty;
  worktreePath: string;
  outputBuffer: string[];
  bufferSize: number;
}

export type TerminalOutputHandler = (terminalId: string, data: string) => void;

export class TerminalService {
  private readonly sessions = new Map<string, TerminalSession>();
  private readonly sessionsByWorktree = new Map<string, string>();
  private readonly onOutput: TerminalOutputHandler;

  constructor(onOutput: TerminalOutputHandler) {
    this.onOutput = onOutput;
  }

  getOrCreate(worktreePath: string): { terminalId: string; existing: boolean } {
    const existingId = this.sessionsByWorktree.get(worktreePath);
    if (existingId && this.sessions.has(existingId)) {
      return { terminalId: existingId, existing: true };
    }

    const id = randomUUID().slice(0, 8);
    const shell = process.env.SHELL ?? "/bin/zsh";

    const term = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: worktreePath,
      env: { ...process.env } as Record<string, string>
    });

    const session: TerminalSession = {
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
    return { terminalId: id, existing: false };
  }

  getBufferedOutput(terminalId: string): string {
    const session = this.sessions.get(terminalId);
    if (!session) return "";
    return session.outputBuffer.join("");
  }

  write(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) throw new Error(`Terminal ${terminalId} not found`);
    session.pty.write(data);
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const session = this.sessions.get(terminalId);
    if (!session) throw new Error(`Terminal ${terminalId} not found`);
    session.pty.resize(cols, rows);
  }

  destroy(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(terminalId);
    this.sessionsByWorktree.delete(session.worktreePath);
  }

  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroy(id);
    }
  }

  private appendBuffer(session: TerminalSession, data: string): void {
    session.outputBuffer.push(data);
    session.bufferSize += data.length;

    while (session.bufferSize > MAX_BUFFER_SIZE && session.outputBuffer.length > 1) {
      const removed = session.outputBuffer.shift();
      if (removed) session.bufferSize -= removed.length;
    }
  }
}
