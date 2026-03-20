import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "info" | "error";
}

interface Props {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function Toast({ messages, onDismiss }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {messages.map((msg) => (
        <ToastItem key={msg.id} message={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(message.id), 200);
    }, 4000);

    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  const bgColor = {
    success: "bg-emerald-600",
    info: "bg-blue-600",
    error: "bg-red-600"
  }[message.type];

  return (
    <div
      className={`${bgColor} rounded-md px-4 py-2 text-sm text-white shadow-lg transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {message.text}
    </div>
  );
}
