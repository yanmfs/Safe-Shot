import { useEffect, useState } from "react";
import { platform } from "../platform";
import { tNow } from "../store";
import { showToast } from "../toast";
import { pasteFromClipboard } from "./doc/actions";
import { useDoc } from "./doc/store";

// Collects every way an image can arrive: drop, paste event and the native paste menu.
export function useIntake(): { dragging: boolean } {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void platform
      .onFileDrop({
        hover: setDragging,
        images: (images) => void useDoc.getState().openMany(images),
        failed: () => showToast(tNow("drop.error"), "error"),
      })
      .then((fn) => (cancelled ? fn() : (unlisten = fn)));

    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      e.preventDefault();
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file) return void pasteFromClipboard();
      void file
        .arrayBuffer()
        .then((buffer) =>
          useDoc
            .getState()
            .open({ bytes: new Uint8Array(buffer), name: file.name || "clipboard.png" }),
        );
    };
    window.addEventListener("paste", onPaste);

    return () => {
      cancelled = true;
      unlisten?.();
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  return { dragging };
}
