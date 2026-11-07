import { ClipboardPaste, FolderOpen } from "lucide-react";
import { Button } from "../../components/Button";
import { modKeyLabel } from "../../core/os";
import { platform } from "../../platform";
import { useT } from "../../store";
import { openFromDialog, pasteFromClipboard } from "../doc/actions";

const FINDS = ["cpf", "cnpj", "phone", "email", "pix", "card", "plate", "cep", "qr"] as const;

// A screenshot of a chat with two lines already covered: it shows the whole idea before any text.
function Sketch() {
  return (
    <svg viewBox="0 0 320 168" aria-hidden className="w-full max-w-[300px]">
      <rect
        x="1"
        y="1"
        width="318"
        height="166"
        rx="10"
        fill="var(--surface)"
        stroke="var(--border-strong)"
      />
      <rect x="1" y="1" width="318" height="26" rx="10" fill="var(--surface-2)" />
      <circle cx="16" cy="14" r="3.5" fill="var(--border-strong)" />
      <circle cx="28" cy="14" r="3.5" fill="var(--border-strong)" />
      <circle cx="40" cy="14" r="3.5" fill="var(--border-strong)" />
      <rect x="18" y="42" width="120" height="22" rx="8" fill="var(--surface-2)" />
      <rect x="28" y="49" width="64" height="8" rx="4" fill="var(--border-strong)" />
      <rect x="130" y="76" width="172" height="22" rx="8" fill="var(--accent-soft)" />
      <rect x="140" y="83" width="38" height="8" rx="4" fill="var(--accent)" opacity=".55" />
      <rect x="182" y="82" width="98" height="10" rx="2.5" fill="var(--text)" />
      <rect x="18" y="108" width="150" height="22" rx="8" fill="var(--surface-2)" />
      <rect x="28" y="115" width="52" height="8" rx="4" fill="var(--border-strong)" />
      <rect x="84" y="114" width="72" height="10" rx="2.5" fill="var(--text)" />
      <rect x="130" y="140" width="132" height="14" rx="7" fill="var(--surface-2)" />
    </svg>
  );
}

export function EmptyState() {
  const t = useT();
  const paste = `${modKeyLabel(platform.os)}+V`;
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <Sketch />
        <div>
          <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight">
            {t("empty.headline")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("empty.hint", { paste })}</p>
        </div>
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
        <ol className="grid w-full grid-cols-3 gap-3 border-t border-border pt-5 text-left text-xs">
          {(["empty.step1", "empty.step2", "empty.step3"] as const).map((key, i) => (
            <li key={key} className="flex gap-2">
              <span className="font-mono text-[11px] font-medium text-accent-text">0{i + 1}</span>
              <span className="text-muted">{t(key)}</span>
            </li>
          ))}
        </ol>
        <p className="flex flex-wrap justify-center gap-1.5">
          <span className="mr-1 self-center text-xs text-muted">{t("empty.finds")}</span>
          {FINDS.map((category) => (
            <span
              key={category}
              className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px]"
            >
              {t(`cat.${category}`)}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
