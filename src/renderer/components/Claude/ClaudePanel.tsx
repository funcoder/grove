import { useEffect, useRef } from "react";
import { claudeStore } from "../../lib/terminal-stores";
import "@xterm/xterm/css/xterm.css";

interface Props {
  worktreePath: string;
}

export function ClaudePanel({ worktreePath }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const session = claudeStore.attach(worktreePath, container);

    const resizeObserver = new ResizeObserver(() => {
      session.fitAddon.fit();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      claudeStore.detach(worktreePath);
    };
  }, [worktreePath]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: "4px 0 0 8px" }}
    />
  );
}
