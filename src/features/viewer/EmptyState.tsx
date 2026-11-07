import { ClipboardPaste, FolderOpen } from "lucide-react";
import { Button } from "../../components/Button";
import { Logo } from "../../components/Logo";
import { modKeyLabel } from "../../core/os";
import { platform } from "../../platform";
import { useT } from "../../store";
import { openFromDialog, pasteFromClipboard } from "../doc/actions";

export function EmptyState() {
  const t = useT();
  const paste = `${modKeyLabel(platform.os)}+V`;
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-panel border-2 border-dashed border-border px-10 py-12 text-center">
        <Logo className="size-14" />
        <h2 className="text-xl font-semibold">{t("empty.title")}</h2>
        <p className="text-sm text-muted">{t("empty.hint", { paste })}</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void openFromDialog()}>
            <FolderOpen className="size-4" aria-hidden />
            {t("empty.open")}
          </Button>
          <Button onClick={() => void pasteFromClipboard()}>
            <ClipboardPaste className="size-4" aria-hidden />
            {t("empty.paste")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{t("empty.brazil")}</p>
      </div>
    </div>
  );
}
