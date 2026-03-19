import { create } from "zustand";
import type { AppSnapshot } from "../../main/ipc/contracts";

interface AppStore extends AppSnapshot {
  setSnapshot: (snapshot: AppSnapshot) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  repos: [],
  activeRepoId: "",
  setSnapshot: (snapshot) => set(snapshot)
}));
