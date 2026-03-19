import { useEffect } from "react";
import { Shell } from "./components/Layout/Shell";
import { useAppStore } from "./state/use-app-store";
import { grove } from "./lib/desktop-api";

export function App() {
  const setSnapshot = useAppStore((s) => s.setSnapshot);

  useEffect(() => {
    grove.getSnapshot().then(setSnapshot);
    const unsub = grove.subscribeToSnapshots(setSnapshot);
    return unsub;
  }, [setSnapshot]);

  return <Shell />;
}
