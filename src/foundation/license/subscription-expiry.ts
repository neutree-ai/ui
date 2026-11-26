import type { LicenseStatus } from "@/foundation/types/license";

export function isExpiredSubscription(
  status: LicenseStatus | null | undefined,
) {
  return (
    status?.phase === "Expired" && status.info?.license_type === "SUBSCRIPTION"
  );
}
