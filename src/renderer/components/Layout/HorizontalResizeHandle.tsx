import { useCallback, useRef } from "react";

interface Props {
  onResize: (deltaX: number) => void;
}

export function HorizontalResizeHandle({ onResize }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragging.current) return;
        const delta = lastX.current - moveEvent.clientX;
        lastX.current = moveEvent.clientX;
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
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex w-1 cursor-col-resize items-center justify-center border-l border-zinc-800 bg-zinc-950 hover:border-blue-600"
    />
  );
}
