export interface ActivityItem {
  id: string;
  type: "tool" | "error";
  toolName?: string;
  detail: string;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  prompt: string;
  result: string;
  activity: ActivityItem[];
  timestamp: number;
}

export interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  // Active message state (currently streaming)
  activePrompt: string;
  activeResult: string;
  activeActivity: ActivityItem[];
  streaming: boolean;
  resultStreaming: boolean;
}

const STORAGE_KEY = "grove:chat-states";
const MAX_MESSAGES = 50;

const EMPTY_STATE: ChatState = {
  sessionId: null,
  messages: [],
  activePrompt: "",
  activeResult: "",
  activeActivity: [],
  streaming: false,
  resultStreaming: false
};

const stateByWorktree = new Map<string, ChatState>();

// Migrate old single-message format to new messages[] format
function migrateOldFormat(state: Record<string, unknown>): ChatState {
  const oldPrompt = state.prompt as string | undefined;
  const oldResult = state.result as string | undefined;
  const oldActivity = state.activity as ActivityItem[] | undefined;

  const messages: ChatMessage[] = [];
  if (oldPrompt || oldResult) {
    messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      prompt: oldPrompt ?? "",
      result: oldResult ?? "",
      activity: oldActivity ?? [],
      timestamp: Date.now()
    });
  }

  return {
    ...EMPTY_STATE,
    messages
  };
}

function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((msg) => {
    // Use prompt + first 100 chars of result as dedup key
    const key = `${msg.prompt}::${msg.result.slice(0, 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isOldFormat(state: Record<string, unknown>): boolean {
  return typeof state.prompt === "string" && !Array.isArray(state.messages);
}

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [path, state] of Object.entries(parsed)) {
      if (isOldFormat(state)) {
        stateByWorktree.set(path, migrateOldFormat(state));
      } else {
        const typed = state as unknown as ChatState;
        stateByWorktree.set(path, {
          ...typed,
          sessionId: null,
          streaming: false,
          resultStreaming: false,
          activePrompt: "",
          activeResult: "",
          activeActivity: [],
          // Deduplicate messages that got corrupted by nested setState bug
          messages: deduplicateMessages(typed.messages ?? [])
        });
      }
    }
  } catch {
    // Corrupted data, start fresh
  }
}

function saveToStorage(): void {
  try {
    const obj: Record<string, ChatState> = {};
    for (const [path, state] of stateByWorktree) {
      if (state.messages.length > 0 || state.activePrompt || state.activeResult) {
        obj[path] = {
          ...state,
          sessionId: null,
          streaming: false,
          resultStreaming: false,
          // Trim to max messages
          messages: state.messages.slice(-MAX_MESSAGES)
        };
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Storage full or unavailable
  }
}

// Init
loadFromStorage();

export function getChatState(worktreePath: string): ChatState {
  return stateByWorktree.get(worktreePath) ?? { ...EMPTY_STATE, messages: [] };
}

export function setChatState(worktreePath: string, state: ChatState): void {
  stateByWorktree.set(worktreePath, state);
  saveToStorage();
}

export function clearChatState(worktreePath: string): void {
  stateByWorktree.set(worktreePath, { ...EMPTY_STATE, messages: [] });
  saveToStorage();
}
