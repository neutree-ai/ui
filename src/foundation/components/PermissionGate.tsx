import type { PropsWithChildren } from "react";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

/** Renders its children only for a user holding `permission`. */
export function PermissionGate({
  permission,
  children,
}: PropsWithChildren<{ permission: string }>) {
  const { t } = useTranslation();
  const { allowed, isLoading } = useHasPermission(permission);

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
