// A key can reach the app twice: as a key press and as the menu item that owns the same shortcut.
// The second arrival within a blink is the same gesture and must not run the action again.
const WINDOW_MS = 150;
const last = new Map<string, number>();

export function firstOf(action: string, now = Date.now()): boolean {
  const before = last.get(action);
  last.set(action, now);
  return before === undefined || now - before > WINDOW_MS;
}
