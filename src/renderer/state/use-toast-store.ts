import { create } from "zustand";
import type { ToastMessage } from "../components/Layout/Toast";

interface ToastStore {
  messages: ToastMessage[];
  show: (text: string, type?: ToastMessage["type"]) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  messages: [],

  show: (text, type = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      messages: [...state.messages, { id, text, type }]
    }));
  },

  dismiss: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id)
    }));
  }
}));
