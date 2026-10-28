import { useUpdate } from "@refinedev/core";
import { Switch } from "@/components/ui/switch";
import { identitySourceErrorMessage } from "@/domains/identity-source/lib/identity-source-errors";
import type { IdentitySource } from "@/domains/identity-source/types";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Turns a source on or off for login. The whole spec is sent back because
 * PostgREST replaces the composite; its secrets read as null, and a null
 * secret keeps the stored one.
 */
export function IdentitySourceEnabledSwitch({
  record,
  disabled,
}: {
  record: IdentitySource;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { mutate, isLoading } = useUpdate();
  const enabled = record.spec?.enabled === true;
  const name = record.metadata.display_name || record.metadata.name;

  return (
    <Switch
      checked={enabled}
      disabled={disabled || isLoading || !!record.metadata.deletion_timestamp}
      aria-label={t("identity_sources.actions.toggleEnabled", { name })}
      data-testid={`identity-source-enabled-${record.metadata.name}`}
      onCheckedChange={(checked) =>
        mutate({
          resource: "identity_sources",
          id: record.metadata.name,
          meta: { idColumnName: "metadata->name" },
          values: { spec: { ...record.spec, enabled: checked } },
          successNotification: () => ({
            type: "success",
            message: t(
              checked
                ? "identity_sources.messages.enabled"
                : "identity_sources.messages.disabled",
              { name },
            ),
          }),
          errorNotification: (error) => ({
            type: "error",
            message: t("identity_sources.messages.toggleFailed", { name }),
            description:
              identitySourceErrorMessage(t, error) ??
              getErrorMessage(error, t("pages.error.unknown")),
          }),
        })
      }
    />
  );
}
