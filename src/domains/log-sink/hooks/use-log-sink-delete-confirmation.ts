import { useTranslation } from "@/foundation/lib/i18n";
import type { DeleteConfirmation } from "@/foundation/scene/DeleteConfirmDialog";

/** Typed-name confirmation with the impact stated; no force path. */
export const useLogSinkDeleteConfirmation = () => {
  const { t } = useTranslation();
  return (name: string): DeleteConfirmation => ({
    description: t("log_sinks.delete.description"),
    confirmName: name,
    allowForceDelete: false,
  });
};
