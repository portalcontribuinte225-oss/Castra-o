import { useEffect, useRef, useState } from "react";
import { createBackStack } from "./back-stack";
import type { BackStack } from "./back-stack";

let pageStack: BackStack | null = null;

function backStack(): BackStack {
  if (!pageStack) {
    const stack = createBackStack(window.history, (task) => queueMicrotask(task), Math.random().toString(36).slice(2));
    window.addEventListener("popstate", (event) => stack.handlePop(event.state));
    pageStack = stack;
  }
  return pageStack;
}

// While `active`, the phone's back button (or the browser's) runs onBack instead of leaving the page. A layer that is still active
// after going back (a request form that went back one step) gets a new entry, so the next back goes on from there.
export function useBackLayer(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  const [popped, setPopped] = useState(0);

  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return undefined;
    const stack = backStack();
    const id = stack.open(() => onBackRef.current(), () => setPopped((count) => count + 1));
    return () => stack.close(id);
  }, [active, popped]);
}
