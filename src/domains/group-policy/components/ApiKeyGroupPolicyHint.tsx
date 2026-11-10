import { useList } from "@refinedev/core";
import { Info } from "lucide-react";
import {
  USER_MODEL_ACCESS_ANCHOR,
  USER_MODEL_ACCESS_WORKSPACE_PARAM,
} from "@/domains/group-policy/components/UserGroupModelAccess";
import { useUserGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import { Link } from "@/foundation/components/Link";
import { useTranslation } from "@/foundation/lib/i18n";
import type { Metadata } from "@/foundation/types/basic-types";

/**
 * Says that the owner's group policies narrow the key's models further, when
 * any of the owner's groups has one. Links to the owner's page when the caller
 * can read it.
 */
export function ApiKeyGroupPolicyHint({
  userId,
  workspace,
}: {
  userId: string;
  workspace: string;
}) {
  const { t } = useTranslation();
  const { policy } = useUserGroupPolicy(userId, workspace, userId !== "");
  const { data: profiles } = useList<{ metadata: Metadata }>({
    resource: "user_profiles",
    filters: [{ field: "id", operator: "eq", value: userId }],
    queryOptions: { enabled: (policy?.groups.length ?? 0) > 0 },
  });

  if (!policy || policy.groups.length === 0) return null;

  const profileName = profiles?.data?.[0]?.metadata?.name;
  const href = profileName
    ? `/user-profiles/show/${encodeURIComponent(profileName)}?${USER_MODEL_ACCESS_WORKSPACE_PARAM}=${encodeURIComponent(workspace)}#${USER_MODEL_ACCESS_ANCHOR}`
    : undefined;

  return (
    <p
      className="flex items-start gap-1.5 text-sm text-muted-foreground"
      data-testid="api-key-group-policy-hint"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {t("group_policies.apiKeyHint")}
        {href && (
          <>
            {" "}
            <Link href={href} className="text-primary hover:underline">
              {t("group_policies.viewDetails")}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
