// A line of items to work through one at a time. `done` counts the ones already finished.
export interface Queue<T> {
  pending: T[];
  done: number;
  total: number;
}

export function startQueue<T>(items: T[]): { first: T; queue: Queue<T> } | null {
  const [first, ...pending] = items;
  return first === undefined ? null : { first, queue: { pending, done: 0, total: items.length } };
}

export function advance<T>(queue: Queue<T>): { next: T; queue: Queue<T> } | null {
  const [next, ...pending] = queue.pending;
  return next === undefined ? null : { next, queue: { ...queue, pending, done: queue.done + 1 } };
}

// 1-based place of the item being worked on.
export const place = (queue: Queue<unknown>): number => queue.done + 1;
