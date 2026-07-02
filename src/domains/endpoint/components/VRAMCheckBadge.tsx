import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/foundation/lib/i18n";
import { checkVRAM } from "@/foundation/recipe/vram";

type Props = {
  acceleratorProduct?: string | null;
  perGpuGb?: number | null;
  gpuCount?: number | string | null;
  requiredGb?: number | null;
};

// VRAMCheckBadge compares the variant's vram_minimum_gb against the form's
// currently picked accelerator × count. Renders one of:
//   ✓ Sufficient VRAM: {acc} × {n} = {total} GB ≥ required {req} GB
//   ⚠ Insufficient VRAM: {acc} × {n} = {total} GB < required {req} GB
//   (nothing — when the check can't be made; we'd rather under-warn)
export const VRAMCheckBadge = ({
  acceleratorProduct,
  perGpuGb,
  gpuCount,
  requiredGb,
}: Props) => {
  const { t } = useTranslation();
  const result = checkVRAM({
    acceleratorProduct,
    perGpuGb,
    gpuCount,
    requiredGb,
  });
  if (result.kind === "unknown") return null;

  const isOK = result.kind === "sufficient";
  const Icon = isOK ? CheckCircle2 : AlertTriangle;
  const cls = isOK
    ? "border-green-600/40 text-green-700 dark:text-green-400 bg-green-500/5"
    : "border-amber-600/50 text-amber-700 dark:text-amber-400 bg-amber-500/5";

  return (
    <div
      data-testid="vram-check-badge"
      data-state={result.kind}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${cls}`}
    >
      <Icon className="size-4" />
      <span>
        {isOK
          ? t("endpoints.recipe.vramOk", "Sufficient VRAM")
          : t("endpoints.recipe.vramLow", "Insufficient VRAM")}
        {": "}
        <span className="font-mono">
          {acceleratorProduct} × {result.gpuCount} = {result.totalGb} GB
        </span>{" "}
        {isOK ? "≥" : "<"}{" "}
        <span className="font-mono">required {result.requiredGb} GB</span>
      </span>
    </div>
  );
};
