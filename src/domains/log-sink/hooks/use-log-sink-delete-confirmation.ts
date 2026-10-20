import type { DeleteConfirmation } from "@/foundation/components/DeleteConfirmDialog";
import { useTranslation } from "@/foundation/lib/i18n";

/** Typed-name confirmation with the impact stated; no force path (data.md, Delete). */
export const useLogSinkDeleteConfirmation = () => {
  const { t } = useTranslation();
  return (name: string): DeleteConfirmation => ({
    description: t("log_sinks.delete.description"),
    confirmName: name,
    allowForceDelete: false,
  });
};
