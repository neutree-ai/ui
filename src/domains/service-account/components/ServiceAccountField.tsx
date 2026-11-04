import { forwardRef, useMemo } from "react";
import { useAllServiceAccounts } from "@/domains/service-account/hooks/use-service-accounts";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { useTranslation } from "@/foundation/lib/i18n";

const accountName = (metadata: {
  name: string;
  display_name?: string | null;
}) => metadata.display_name || metadata.name;

type ServiceAccountFieldProps = {
  /** The id of the selected application. */
  value?: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

/** Picks an application the caller may read, by id. */
export const ServiceAccountField = forwardRef<
  HTMLDivElement,
  ServiceAccountFieldProps
>(({ value, onChange, disabled }, ref) => {
  const { t } = useTranslation();
  const query = useAllServiceAccounts();
  const options = useMemo(
    () =>
      (query.data?.data ?? []).map((account) => ({
        label: accountName(account.metadata),
        value: account.id,
      })),
    [query.data],
  );
  return (
    <FormCombobox
      ref={ref}
      value={value ?? ""}
      onChange={(next) => onChange?.(String(next))}
      disabled={disabled || query.isLoading}
      allowUnselect={false}
      placeholder={t("service_accounts.placeholders.select")}
      options={options}
    />
  );
});

ServiceAccountField.displayName = "ServiceAccountField";

/** An application by id, shown by its display name. */
export function ServiceAccountLabel({ id }: { id: string }) {
  const query = useAllServiceAccounts();
  const account = (query.data?.data ?? []).find((row) => row.id === id);
  return (
    <span data-testid="service-account-label">
      {account ? accountName(account.metadata) : id}
    </span>
  );
}
