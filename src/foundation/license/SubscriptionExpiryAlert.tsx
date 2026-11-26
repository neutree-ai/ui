import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLicense } from "./use-license";

export function SubscriptionExpiryAlert() {
  const { t } = useTranslation();
  const { isExpiredSubscription } = useLicense(60_000);

  if (!isExpiredSubscription) return null;

  return (
    <Alert variant="destructive" className="rounded-none shrink-0">
      <AlertDescription>{t("license.subscriptionExpired")}</AlertDescription>
    </Alert>
  );
}
