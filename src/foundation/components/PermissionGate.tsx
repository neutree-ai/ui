import type { PropsWithChildren } from "react";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { useHasAnyPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

/** Renders its children only for a user holding `permission`, or any one listed. */
export function PermissionGate({
  permission,
  children,
}: PropsWithChildren<{ permission: string | readonly string[] }>) {
  const { t } = useTranslation();
  const { allowed: held, isLoading } = useHasAnyPermission(permission);
  const allowed = held === true;

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
