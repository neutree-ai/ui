import { useTranslation } from "@/foundation/lib/i18n";
import Timestamp from "@/foundation/role/Timestamp";

type ConnectionTest = { ok: boolean; time?: string | null };

/** The outcome of a resource's last connection test and when it ran. */
export function ConnectionTestResult({
  test,
}: {
  test?: ConnectionTest | null;
}) {
  const { t } = useTranslation();

  if (!test?.time) return t("common.connectionTest.never");

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className={
          test.ok
            ? "text-[var(--nt-text-colorful-positive)]"
            : "text-[var(--nt-text-colorful-serious)]"
        }
      >
        {t(
          test.ok ? "common.connectionTest.ok" : "common.connectionTest.failed",
        )}
      </span>
      <Timestamp timestamp={test.time} relative />
    </span>
  );
}
