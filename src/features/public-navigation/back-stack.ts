// The public pages keep a stack of layers: an open window, the ☰ menu, a step of the request form, an open service. Each open layer
// owns one entry of the browser history, so the phone's back button closes the last layer instead of leaving the site.

// The part of the browser history the stack uses; the page passes window.history and the tests a history in memory.
export interface BackHistory {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  go(delta: number): void;
}

export interface BackStack {
  // A layer opened: onBack runs when the person goes back past its entry; onPopped then tells the owner that the entry is gone.
  open(onBack: () => void, onPopped: () => void): number;
  // The page closed the layer itself (its X, its Voltar): its entry leaves the history, and its onBack does not run.
  close(id: number): void;
  handlePop(state: unknown): void;
}

const STATE_KEY = "castragestaoBackLayer";

interface Mark {
  session: string;
  depth: number;
}

function readMark(state: unknown): Mark | null {
  if (!state || typeof state !== "object") return null;
  const mark = (state as Record<string, unknown>)[STATE_KEY];
  if (!mark || typeof mark !== "object") return null;
  const { session, depth } = mark as Record<string, unknown>;
  return typeof session === "string" && typeof depth === "number" ? { session, depth } : null;
}

// `schedule` runs a task once the current changes end (a microtask on the page): the layers a page change closes and opens
// together become a single move in the history. `session` tells this page's entries apart from those left by an earlier load.
export function createBackStack(history: BackHistory, schedule: (task: () => void) => void, session: string): BackStack {
  let nextId = 1;
  const layers = new Map<number, { onBack: () => void; onPopped: () => void }>();
  const entries: { id: number; closed: boolean }[] = [];
  const waiting: number[] = [];
  let pendingPops = 0;
  let flushScheduled = false;

  function push(id: number) {
    entries.push({ id, closed: false });
    history.pushState({ [STATE_KEY]: { session, depth: entries.length } }, "");
  }

  function pushWaiting() {
    while (pendingPops === 0 && waiting.length > 0) {
      const id = waiting.shift() as number;
      if (layers.has(id)) push(id);
    }
  }

  // The closed entries at the top of the history leave it in one move; the layers opened meanwhile get their entries after it.
  function flush() {
    flushScheduled = false;
    let closed = 0;
    while (entries.length > 0 && entries[entries.length - 1].closed) {
      entries.pop();
      closed += 1;
    }
    if (closed > 0) {
      pendingPops += 1;
      history.go(-closed);
      return;
    }
    pushWaiting();
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    schedule(flush);
  }

  return {
    open(onBack, onPopped) {
      const id = nextId;
      nextId += 1;
      layers.set(id, { onBack, onPopped });
      if (flushScheduled || pendingPops > 0 || waiting.length > 0) waiting.push(id);
      else push(id);
      return id;
    },
    close(id) {
      layers.delete(id);
      const waitingIndex = waiting.indexOf(id);
      if (waitingIndex >= 0) waiting.splice(waitingIndex, 1);
      const entry = entries.find((item) => item.id === id && !item.closed);
      if (!entry) return;
      entry.closed = true;
      scheduleFlush();
    },
    handlePop(state) {
      if (pendingPops > 0) {
        pendingPops -= 1;
        pushWaiting();
        return;
      }
      // Below this page's entries (the page itself, or an entry from an earlier load) every layer closes.
      const mark = readMark(state);
      const depth = mark && mark.session === session ? mark.depth : 0;
      if (depth >= entries.length) return;
      for (const entry of entries.splice(depth).reverse()) {
        const layer = layers.get(entry.id);
        if (entry.closed || !layer) continue;
        layer.onBack();
        layer.onPopped();
      }
    },
  };
}
