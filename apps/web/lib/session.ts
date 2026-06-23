"use client";

import { useSyncExternalStore } from "react";
import { ACCESS_TOKEN_KEY, TOKEN_STORAGE_EVENT } from "./api";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = () => onStoreChange();
  window.addEventListener("storage", listener);
  window.addEventListener(TOKEN_STORAGE_EVENT, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(TOKEN_STORAGE_EVENT, listener);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function useStoredToken() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
