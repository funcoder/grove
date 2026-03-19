import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const TERMINAL_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  theme: {
    background: "#09090b",
    foreground: "#d4d4d8",
    cursor: "#d4d4d8",
    selectionBackground: "#27272a"
  },
  cursorBlink: true
};

export interface PersistentSession {
  terminal: Terminal;
  fitAddon: FitAddon;
  sessionId: string | null;
  unsub: (() => void) | null;
  wrapperEl: HTMLDivElement;
  initialized: boolean;
}

type SpawnFn = (worktreePath: string) => Promise<string>;
type OutputSubscriber = (cb: (id: string, data: string) => void) => () => void;
type WriteFn = (sessionId: string, data: string) => void;
type ResizeFn = (sessionId: string, cols: number, rows: number) => void;

interface SessionStoreConfig {
  spawn: SpawnFn;
  onOutput: OutputSubscriber;
  write: WriteFn;
  resize: ResizeFn;
}

export class PersistentTerminalStore {
  private readonly sessions = new Map<string, PersistentSession>();
  private readonly config: SessionStoreConfig;

  constructor(config: SessionStoreConfig) {
    this.config = config;
  }

  attach(worktreePath: string, container: HTMLDivElement): PersistentSession {
    let session = this.sessions.get(worktreePath);

    if (!session) {
      session = this.createSession(worktreePath);
      this.sessions.set(worktreePath, session);
    }

    // Move the wrapper element into the container
    container.appendChild(session.wrapperEl);

    // Delay fit until after layout — container may have zero size on first frame
    requestAnimationFrame(() => {
      session.fitAddon.fit();
    });

    return session;
  }

  detach(worktreePath: string): void {
    const session = this.sessions.get(worktreePath);
    if (!session) return;

    // Remove from DOM but keep alive
    if (session.wrapperEl.parentElement) {
      session.wrapperEl.parentElement.removeChild(session.wrapperEl);
    }
  }

  private createSession(worktreePath: string): PersistentSession {
    const terminal = new Terminal(TERMINAL_OPTIONS);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Create a wrapper div that persists across attach/detach
    const wrapperEl = document.createElement("div");
    wrapperEl.style.width = "100%";
    wrapperEl.style.height = "100%";

    terminal.open(wrapperEl);

    const session: PersistentSession = {
      terminal,
      fitAddon,
      sessionId: null,
      unsub: null,
      wrapperEl,
      initialized: false
    };

    // Spawn the pty process
    this.config.spawn(worktreePath).then((id) => {
      session.sessionId = id;
      session.initialized = true;

      const { cols, rows } = terminal;
      this.config.resize(id, cols, rows);
    });

    // Wire input from xterm to pty
    terminal.onData((data) => {
      if (session.sessionId) {
        this.config.write(session.sessionId, data);
      }
    });

    terminal.onResize(({ cols, rows }) => {
      if (session.sessionId) {
        this.config.resize(session.sessionId, cols, rows);
      }
    });

    // Wire output from pty to xterm (runs continuously, even when detached)
    session.unsub = this.config.onOutput((id, data) => {
      if (id === session.sessionId) {
        terminal.write(data);
      }
    });

    return session;
  }
}
