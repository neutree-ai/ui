import { useAllServiceAccounts } from "@/domains/service-account/hooks/use-service-accounts";

const accountName = (metadata: {
  name: string;
  display_name?: string | null;
}) => metadata.display_name || metadata.name;

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
