import * as Switch from "@radix-ui/react-switch";
import { TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import { Button } from "../../components/Button";
import { CATEGORIES, type Category, type Detection } from "../../core/detect";
import { useT } from "../../store";
import { CATEGORY_COLOR } from "../categories";
import { useDoc } from "../doc/store";

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <Switch.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={onChange}
      className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-surface-2 transition-colors duration-150 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
    >
      <Switch.Thumb className="block size-3.5 translate-x-[3px] rounded-full bg-muted transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-contrast" />
    </Switch.Root>
  );
}

function Group({ category, items }: { category: Category; items: Detection[] }) {
  const t = useT();
  const id = useId();
  const off = useDoc((s) => s.edit.off);
  const { toggleDetection, toggleCategory } = useDoc.getState();
  const label = t(`cat.${category}`);
  const allHidden = items.every((d) => !off.includes(d.id));

  return (
    <section aria-labelledby={id} className="border-b border-border py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: CATEGORY_COLOR[category] }}
          />
          {label}
          <span className="text-xs font-normal text-muted">{items.length}</span>
        </h3>
        {items.length > 1 && (
          <Check
            label={t("sidebar.hideCategory", { category: label })}
            checked={allHidden}
            onChange={(hidden) => toggleCategory(category, hidden)}
          />
        )}
      </div>
      <ul className="flex flex-col">
        {items.map((d) => (
          <li key={d.id} className="flex min-h-9 items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-[13px]">{d.preview}</span>
              {d.confidence === "medium" && (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <TriangleAlert aria-hidden className="size-3" />
                  {t("sidebar.reviewTag")}
                </span>
              )}
            </span>
            <Check
              label={t("sidebar.hide", { value: d.preview })}
              checked={!off.includes(d.id)}
              onChange={() => toggleDetection(d.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Sidebar() {
  const t = useT();
  const detections = useDoc((s) => s.detections);
  const words = useDoc((s) => s.edit.words);
  const manual = useDoc((s) => s.edit.manual);
  const selected = useDoc((s) => s.selectedMark);
  const status = useDoc((s) => s.status);
  const { removeMark, selectMark } = useDoc.getState();

  const total = detections.length;
  const marks = [
    ...words.map((m) => ({ id: m.id, label: t("sidebar.wordItem") })),
    ...manual.map((m, i) => ({ id: m.id, label: t("sidebar.manualItem", { n: i + 1 }) })),
  ];

  return (
    <aside
      aria-label={t("sidebar.title")}
      className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface px-4 py-3"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("sidebar.title")}
        </h2>
        {status === "ready" && (
          <span className="text-xs text-muted">{t("sidebar.count", { count: total })}</span>
        )}
      </div>

      {status === "ready" && total === 0 && (
        <p className="mt-3 text-sm text-muted">{t("sidebar.nothing")}</p>
      )}

      {CATEGORIES.map((category) => {
        const items = detections.filter((d) => d.category === category);
        return items.length > 0 ? <Group key={category} category={category} items={items} /> : null;
      })}

      {marks.length > 0 && (
        <section className="py-3">
          <h3 className="mb-1 text-sm font-semibold">{t("sidebar.manual")}</h3>
          <ul>
            {marks.map((m) => (
              <li
                key={m.id}
                className={`flex min-h-9 items-center justify-between rounded-control px-2 text-sm ${selected === m.id ? "bg-surface-2" : ""}`}
              >
                <button
                  type="button"
                  className="flex-1 py-1 text-left"
                  onClick={() => selectMark(m.id)}
                >
                  {m.label}
                </button>
                <Button
                  variant="ghost"
                  icon
                  aria-label={t("sidebar.remove")}
                  onClick={() => removeMark(m.id)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
