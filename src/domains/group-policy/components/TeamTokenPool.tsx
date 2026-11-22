import { TokenPoolSummary } from "@/domains/group-policy/components/GroupModelAccess";
import { useGroupTokenPool } from "@/domains/group-policy/hooks/use-group-policies";
import { useTranslation } from "@/foundation/lib/i18n";
import { ShowPage } from "@/foundation/scene/ShowPage";

/**
 * A Team's token pool and what is left of it, read only. get_group_token_pools
 * returns no row when the Team has no pool, and refuses a caller who may read
 * neither group policies nor the Team's usage.
 */
export function TeamTokenPool({
  teamName,
  project = false,
}: {
  teamName: string;
  /** A scenario: its texts say scenario instead of team. */
  project?: boolean;
}) {
  const { t } = useTranslation();
  const { pool, error, isLoading } = useGroupTokenPool("Team", teamName, true);

  return (
    <ShowPage.Section
      title={t("group_policies.pool.title")}
      data-testid="team-token-pool"
    >
      {pool ? (
        <TokenPoolSummary
          quota={{ limit: pool.token_limit, period: pool.period }}
          pool={pool}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? t("api_keys.messages.loading")
            : error
              ? t(
                  project
                    ? "group_policies.pool.unreadableProject"
                    : "group_policies.pool.unreadable",
                )
              : t(
                  project
                    ? "group_policies.pool.noneProject"
                    : "group_policies.pool.none",
                )}
        </p>
      )}
    </ShowPage.Section>
  );
}
