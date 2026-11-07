import { Dialog } from "../../components/Dialog";
import { useApp, useT } from "../../store";

export function WhyDialog() {
  const t = useT();
  const open = useApp((s) => s.whyOpen);
  const setDialog = useApp((s) => s.setDialog);
  return (
    <Dialog open={open} onOpenChange={(o) => setDialog("whyOpen", o)} title={t("bar.whyTitle")}>
      <p className="text-sm leading-relaxed">{t("bar.whyBody")}</p>
    </Dialog>
  );
}
