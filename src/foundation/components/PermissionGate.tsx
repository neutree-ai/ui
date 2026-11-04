import type { PropsWithChildren } from "react";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

/** Renders its children only for a user holding `permission` or `orPermission`. */
export function PermissionGate({
  permission,
  orPermission,
  children,
}: PropsWithChildren<{ permission: string; orPermission?: string }>) {
  const { t } = useTranslation();
  const required = useHasPermission(permission);
  const alternative = useHasPermission(orPermission);
  const allowed =
    required.allowed === true ||
    (!!orPermission && alternative.allowed === true);
  const isLoading =
    !allowed &&
    (required.isLoading || (!!orPermission && alternative.isLoading));

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="w-16 text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <EmptyState variant="page" data-testid="no-permission">
        {t("common.messages.noPermission")}
      </EmptyState>
    );
  }

  return <>{children}</>;
}
