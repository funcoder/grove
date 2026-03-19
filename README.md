# Grove — Git Worktree IDE

A personal Electron + React IDE built around **git worktrees** as first-class citizens. Designed for developers who work on multiple features in parallel and want a unified dashboard for managing worktrees, running code, reviewing diffs, and interacting with AI — all in one window.

> **Early Development** — This project is in active early development. Expect breaking changes, missing features, and rough edges. Built for a specific personal workflow first, open-sourced for others who share similar needs.

## Why

Working on multiple features in parallel with standard git is painful:

- Stashing/switching branches loses context
- Multiple terminal windows for different features
- No unified view of what's running where
- AI coding tools (like Claude Code) don't integrate with worktree workflows

Grove treats **worktrees as the unit of work**. Each worktree gets its own file tree, terminal, AI session, and run configuration — all visible in a single window.

## What It Does

### Worktree Management
- **Branch → Worktree hierarchy** in the sidebar
- Create new branches with auto-worktree setup
- Checkout existing branches into worktrees
- Auto-runs setup hooks (`pnpm install`, `.env` copy)
- Status badges: clean/dirty, ahead/behind counts

### Code Editing
- **Monaco Editor** with auto-save (2s debounce)
- File tree with language-specific icons
- Tab management with dirty indicators

### Git Operations
- **Diff viewer** with Monaco DiffEditor (side-by-side)
- Stage/unstage individual files
- **Auto-generate commit messages** from changes
- Commit, push, pull — all from the UI
- Real-time status polling (5s interval)

### Integrated Terminal
- **Per-worktree shell** via `node-pty` + `xterm.js`
- Persistent sessions — survives tab switches
- **Run detection** — auto-detects project type and run command
- Auto-opens browser for web projects

### AI Chat (Claude Code)
- **Structured chat panel** — not a raw terminal
- Split view: **Result** (top) + **Activity** (bottom, collapsible)
- Result renders from the top (natural reading order)
- Activity feed shows tool calls in real-time with animated indicator
- Markdown rendering with syntax-highlighted code blocks
- Uses Claude Code CLI with `--output-format stream-json`
- Each worktree gets its own conversation context
- Runs with your existing Claude subscription (no API key needed)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Electron + Vite |
| Frontend | React + TypeScript |
| Editor | Monaco Editor |
| Git | `simple-git` |
| Terminal | `node-pty` + `xterm.js` |
| AI | Claude Code CLI |
| State | Zustand (snapshot-driven) |
| Styling | Tailwind CSS v4 |
| Validation | Zod |

## Architecture

```
Main Process (Electron)
├── RepoController          — Owns state, pushes snapshots
├── GitService              — simple-git wrapper
├── WorktreeService         — Create/delete/setup worktrees
├── FileService             — Read/write/watch files
├── TerminalService         — node-pty shell per worktree
├── ClaudeCodeService       — Claude CLI via node-pty (terminal mode)
├── ClaudeChatService       — Claude CLI stream-json (chat mode)
├── RunDetector             — Auto-detect project run commands
└── PortService             — Port allocation

Renderer (React)
├── Zustand store           — Immutable snapshot from main
├── Monaco Editor           — Code + diff viewing
├── xterm.js                — Terminal display
├── Chat UI                 — Structured Claude Code interaction
└── Tailwind components     — Layout, sidebar, panels
```

**Key pattern:** Main process owns ALL state. Pushes immutable `AppSnapshot` to renderer via IPC. Renderer never mutates — calls IPC methods, receives new snapshot.

## Getting Started

```bash
# Clone
git clone <repo-url>
cd grove

# Install
pnpm install

# Dev
pnpm dev
```

### Requirements

- **Node.js** 20+
- **pnpm** 10+
- **Claude Code CLI** installed (`claude` command available)
- **macOS** (primary target, may work on Linux)

## Layout

Optimized for 14" MacBook (1512x982):

```
+--------------------------------------------+
| Activity | Editor / Diff    | Claude Chat  |
| Bar      |                  | (always on)  |
| (40px)   |                  |              |
|          |                  | [result]     |
|          | +-- Terminal --+ |              |
|          | | $ shell      | | [activity]  |
|          | +--------------+ | [input]     |
+--------------------------------------------+
| Status Bar                                 |
+--------------------------------------------+
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Toggle file tree |
| `Cmd+2` | Toggle branch/worktree sidebar |
| `Cmd+3` | Toggle diff view |
| `Cmd+J` | Toggle terminal |
| `Cmd+B` | Cycle sidebar panels |
| `Cmd+Shift+N` | New branch dialog |
| `Cmd+Shift+D` | Open diff view |

## Status

This is a personal tool built for a specific workflow. Features are added as needed. If you find it useful, great — but expect:

- No guaranteed API stability
- Opinionated defaults (e.g., `pnpm` preferred, macOS focused)
- Features driven by personal needs first

## License

MIT
