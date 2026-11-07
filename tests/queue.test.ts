import { describe, expect, it } from "vitest";
import { advance, place, startQueue } from "../src/core/queue";

describe("queue", () => {
  it("starts with the first item and keeps the rest waiting", () => {
    const started = startQueue(["a", "b", "c"]);
    expect(started?.first).toBe("a");
    expect(started?.queue).toEqual({ pending: ["b", "c"], done: 0, total: 3 });
    expect(started && place(started.queue)).toBe(1);
  });

  it("does not start with nothing", () => {
    expect(startQueue([])).toBeNull();
  });

  it("moves through the items in order and then stops", () => {
    let queue = startQueue([1, 2, 3])!.queue;
    const seen: number[] = [];
    for (let step = advance(queue); step; step = advance(queue)) {
      seen.push(step.next);
      queue = step.queue;
    }
    expect(seen).toEqual([2, 3]);
    expect(place(queue)).toBe(3);
    expect(queue.pending).toEqual([]);
    expect(queue.total).toBe(3);
  });
});
