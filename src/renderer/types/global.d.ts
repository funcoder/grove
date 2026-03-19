import type { DesktopApi } from "../../main/preload";

declare global {
  interface Window {
    grove: DesktopApi;
  }
}

export {};
