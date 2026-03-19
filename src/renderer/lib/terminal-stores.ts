import { PersistentTerminalStore } from "./persistent-terminal";
import { grove } from "./desktop-api";

export const shellStore = new PersistentTerminalStore({
  spawn: async (worktreePath) => {
    const { terminalId } = await grove.terminalCreate({ worktreePath });
    return terminalId;
  },
  onOutput: (cb) => grove.onTerminalOutput(cb),
  write: (id, data) => { grove.terminalWrite({ terminalId: id, data }); },
  resize: (id, cols, rows) => { grove.terminalResize({ terminalId: id, cols, rows }); }
});

export const claudeStore = new PersistentTerminalStore({
  spawn: async (worktreePath) => {
    const { sessionId } = await grove.claudeSpawn({ worktreePath });
    return sessionId;
  },
  onOutput: (cb) => grove.onClaudeOutput(cb),
  write: (id, data) => { grove.claudeWrite({ terminalId: id, data }); },
  resize: (id, cols, rows) => { grove.claudeResize({ terminalId: id, cols, rows }); }
});
