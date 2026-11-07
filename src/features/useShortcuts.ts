import { useEffect } from "react";
import { copyResult, openFromDialog, saveResult } from "./doc/actions";
import { useDoc } from "./doc/store";
import { firstOf } from "./actionGuard";
import { useView } from "./viewer/view";

const isTyping = (e: KeyboardEvent) =>
  e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const doc = useDoc.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        const action = e.shiftKey ? "redo" : "undo";
        if (firstOf(action)) doc[action]();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        if (firstOf("redo")) doc.redo();
        return;
      }
      if (mod && key === "o") {
        e.preventDefault();
        if (firstOf("open")) void openFromDialog();
        return;
      }
      if (!doc.doc) return;
      if (mod && key === "c") {
        e.preventDefault();
        if (firstOf("copy")) void copyResult();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        if (firstOf("save")) void saveResult();
        return;
      }
      if (mod && key === "0") {
        e.preventDefault();
        return useView.getState().fit(doc.doc.width, doc.doc.height);
      }
      if (mod && key === "1") {
        e.preventDefault();
        return useView.getState().zoomTo(1);
      }
      if (mod || e.altKey) return;
      if (key === "r") doc.setTool("rect");
      else if (key === "v") doc.setTool("select");
      else if ((key === "delete" || key === "backspace") && doc.selectedMark)
        doc.removeMark(doc.selectedMark);
      else if (key === "escape") doc.selectMark(null);
    };
    // On macOS the Copy item of the menu fires this instead of a key press. Text the person
    // selected, or typed into a field, keeps the normal copy.
    const onCopy = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if ((window.getSelection()?.toString() ?? "") !== "" || !useDoc.getState().doc) return;
      e.preventDefault();
      if (firstOf("copy")) void copyResult();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("copy", onCopy);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copy", onCopy);
    };
  }, []);
}
