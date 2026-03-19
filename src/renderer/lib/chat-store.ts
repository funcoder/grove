interface ActivityItem {
  id: string;
  type: "tool" | "error";
  toolName?: string;
  detail: string;
  result?: string;
}

export interface ChatState {
  sessionId: string | null;
  result: string;
  resultStreaming: boolean;
  activity: ActivityItem[];
  prompt: string;
  streaming: boolean;
}

const STORAGE_KEY = "grove:chat-states";

const EMPTY_STATE: ChatState = {
  sessionId: null,
  result: "",
  resultStreaming: false,
  activity: [],
  prompt: "",
  streaming: false
};

const stateByWorktree = new Map<string, ChatState>();

// Load from localStorage on init
function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, ChatState>;
    for (const [path, state] of Object.entries(parsed)) {
      stateByWorktree.set(path, {
        ...state,
        sessionId: null,
        streaming: false,
        resultStreaming: false
      });
    }
  } catch {
    // Corrupted data, start fresh
  }
}

function saveToStorage(): void {
  try {
    const obj: Record<string, ChatState> = {};
    for (const [path, state] of stateByWorktree) {
      // Only persist states that have content
      if (state.prompt || state.result) {
        obj[path] = {
          ...state,
          sessionId: null,
          streaming: false,
          resultStreaming: false
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
  return stateByWorktree.get(worktreePath) ?? { ...EMPTY_STATE };
}

export function setChatState(worktreePath: string, state: ChatState): void {
  stateByWorktree.set(worktreePath, state);
  saveToStorage();
}
