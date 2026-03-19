import { useCallback, useRef } from "react";

interface Props {
  onResize: (deltaY: number) => void;
}

export function ResizeHandle({ onResize }: Props) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastY.current = e.clientY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragging.current) return;
        const delta = lastY.current - moveEvent.clientY;
        lastY.current = moveEvent.clientY;
        onResize(delta);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex h-1 cursor-row-resize items-center justify-center border-t border-zinc-800 bg-zinc-950 hover:border-blue-600"
    >
      <div className="h-0.5 w-8 rounded-full bg-zinc-700" />
    </div>
  );
}
