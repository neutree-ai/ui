import { useTranslation } from "@/foundation/lib/i18n";

// Explains why observed values are missing. Other states need no note: data
// shows itself, and allocation information stays visible either way.
export function ObservationStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status !== "unavailable" && status !== "not_configured") return null;
  return (
    <p role="status" className="mb-3 text-xs text-muted-foreground">
      {t(`observations.status.${status}`)}
    </p>
  );
}
