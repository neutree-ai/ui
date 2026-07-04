import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useTranslation } from "@/foundation/lib/i18n";
import { checkVRAM } from "@/foundation/recipe/vram";

type Props = {
  acceleratorProduct?: string | null;
  perGpuGb?: number | null;
  gpuCount?: number | string | null;
  requiredGb?: number | null;
};

// VRAMCheckBadge compares the variant's vram_minimum_gb against the currently
// picked cluster accelerator × count. The accelerator model itself is never
// rendered — only the memory comparison matters here, and echoing a product
// name invites misreading recipe-declared reference hardware as the user's
// actual environment (NEU-499). Renders one of:
//   ✓ Sufficient VRAM: {total} GB available, {req} GB required
//   ⚠ Insufficient VRAM: {total} GB available, {req} GB required
//   ℹ Requires ≥ {req} GB VRAM   — no trustworthy accelerator data yet; show
//     the requirement alone rather than math derived from recipe defaults.
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

  if (result.kind === "unknown") {
    // Without a floor there is nothing meaningful to say at all.
    if (!requiredGb || requiredGb <= 0) return null;

    return (
      <div
        data-testid="vram-check-badge"
        data-state="required-only"
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm border-border text-muted-foreground"
      >
        <Info className="size-4" />
        <span>
          {t("endpoints.recipe.vramRequiredOnly", "Requires ≥ {{gb}} GB VRAM", {
            gb: requiredGb,
          })}
        </span>
      </div>
    );
  }

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
          ? t(
              "endpoints.recipe.vramSufficient",
              "Sufficient VRAM: {{total}} GB available, {{required}} GB required",
              { total: result.totalGb, required: result.requiredGb },
            )
          : t(
              "endpoints.recipe.vramInsufficient",
              "Insufficient VRAM: {{total}} GB available, {{required}} GB required",
              { total: result.totalGb, required: result.requiredGb },
            )}
      </span>
    </div>
  );
};
