import { useEffect } from "react";
import { copyResult, openFromDialog, saveResult } from "./doc/actions";
import { useDoc } from "./doc/store";
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
        return e.shiftKey ? doc.redo() : doc.undo();
      }
      if (mod && key === "y") {
        e.preventDefault();
        return doc.redo();
      }
      if (mod && key === "o") {
        e.preventDefault();
        return void openFromDialog();
      }
      if (!doc.doc) return;
      if (mod && key === "c") {
        e.preventDefault();
        return void copyResult();
      }
      if (mod && key === "s") {
        e.preventDefault();
        return void saveResult();
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
