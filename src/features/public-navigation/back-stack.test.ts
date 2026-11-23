import { describe, expect, it, vi } from "vitest";
import { createBackStack } from "./back-stack";

// A browser history in memory. pushState drops the entries ahead of the current one, as the browser does; go() only moves when
// travel() runs, as the browser moves after the current task; back() is the person pressing the back button.
function memoryHistory(firstState: unknown = null) {
  const entries: unknown[] = [firstState];
  let index = 0;
  const moves: number[] = [];
  const tasks: (() => void)[] = [];
  const history = {
    get state() { return entries[index]; },
    pushState(data: unknown) {
      entries.splice(index + 1);
      entries.push(data);
      index += 1;
    },
    go(delta: number) { moves.push(delta); },
  };
  const stack = createBackStack(history, (task) => tasks.push(task), "this-page");
  return {
    stack,
    entries,
    moves,
    length: () => index + 1,
    runTasks() { while (tasks.length) (tasks.shift() as () => void)(); },
    travel() {
      while (moves.length) {
        index += moves.shift() as number;
        stack.handlePop(entries[index]);
      }
    },
    back(steps = 1) {
      index -= steps;
      stack.handlePop(entries[index]);
    },
    forward() {
      index += 1;
      stack.handlePop(entries[index]);
    },
  };
}

describe("public back stack", () => {
  it("gives each open layer one entry and closes only the last one on back", () => {
    const page = memoryHistory();
    const service = vi.fn();
    const dialog = vi.fn();
    page.stack.open(service, () => {});
    page.stack.open(dialog, () => {});
    expect(page.length()).toBe(3);

    page.back();
    expect(dialog).toHaveBeenCalledTimes(1);
    expect(service).not.toHaveBeenCalled();
  });

  it("closes the layers from the last one when the back skips several entries", () => {
    const page = memoryHistory();
    const order: string[] = [];
    page.stack.open(() => order.push("service"), () => {});
    page.stack.open(() => order.push("step"), () => {});
    page.back(2);
    expect(order).toEqual(["step", "service"]);
  });

  it("gives a layer that stays open after going back a new entry for the next back", () => {
    const page = memoryHistory();
    const step = vi.fn();
    let popped = 0;
    const first = page.stack.open(step, () => { popped += 1; });
    page.back();
    expect(popped).toBe(1);

    // The owner closes the entry that left and opens the layer again, as the hook does when its layer is still active.
    page.stack.close(first);
    page.stack.open(step, () => { popped += 1; });
    page.runTasks();
    expect(page.moves).toEqual([]);
    expect(page.length()).toBe(2);

    page.back();
    expect(step).toHaveBeenCalledTimes(2);
  });

  it("takes out the entry of a layer closed on the page without running its onBack", () => {
    const page = memoryHistory();
    const dialog = vi.fn();
    const id = page.stack.open(dialog, () => {});
    page.stack.close(id);
    page.runTasks();
    expect(page.moves).toEqual([-1]);

    page.travel();
    expect(page.length()).toBe(1);
    expect(dialog).not.toHaveBeenCalled();
  });

  it("takes out a closed layer and the layers above it in a single move", () => {
    const page = memoryHistory();
    const service = page.stack.open(vi.fn(), () => {});
    const step = page.stack.open(vi.fn(), () => {});
    page.stack.close(step);
    page.stack.close(service);
    page.runTasks();
    expect(page.moves).toEqual([-2]);
  });

  it("gives a layer opened together with a closing one its entry only after the history has moved", () => {
    const page = memoryHistory();
    const menu = page.stack.open(vi.fn(), () => {});
    page.stack.close(menu);
    const service = vi.fn();
    page.stack.open(service, () => {});
    expect(page.length()).toBe(2);

    page.runTasks();
    page.travel();
    expect(page.length()).toBe(2);

    page.back();
    expect(service).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the person goes forward to an entry it no longer has", () => {
    const page = memoryHistory();
    const service = vi.fn();
    const dialog = vi.fn();
    page.stack.open(service, () => {});
    page.stack.open(dialog, () => {});
    page.back();
    page.forward();
    expect(dialog).toHaveBeenCalledTimes(1);
    expect(service).not.toHaveBeenCalled();
  });

  it("closes every layer when the person goes back to an entry left by an earlier load", () => {
    const earlier = { castragestaoBackLayer: { session: "earlier-load", depth: 1 } };
    const page = memoryHistory(earlier);
    const service = vi.fn();
    page.stack.open(service, () => {});
    page.back();
    expect(service).toHaveBeenCalledTimes(1);
  });

  it("keeps the state of the entries it did not create", () => {
    const own = { scroll: 120 };
    const page = memoryHistory(own);
    page.stack.open(vi.fn(), () => {});
    expect(page.entries[0]).toBe(own);
    expect(page.entries[0]).toEqual({ scroll: 120 });
  });
});
