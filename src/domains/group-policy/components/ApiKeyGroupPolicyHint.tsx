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
 * Says that the owner's policies narrow the key's models further, when any
 * applies: one of a group of the owner, or one set on the owner itself. The
 * owner is a user or an application. Links to a user owner's page when the
 * caller can read it.
 */
export function ApiKeyGroupPolicyHint({
  userId,
  serviceAccountId,
  workspace,
}: {
  userId?: string;
  serviceAccountId?: string;
  workspace: string;
}) {
  const { t } = useTranslation();
  const owner = userId || serviceAccountId || "";
  const { policy } = useUserGroupPolicy(owner, workspace, owner !== "");
  const applies =
    !!policy &&
    (policy.groups.length > 0 ||
      (policy.subject_policies ?? []).some((own) => own.in_scope));
  const { data: profiles } = useList<{ metadata: Metadata }>({
    resource: "user_profiles",
    filters: [{ field: "id", operator: "eq", value: userId }],
    queryOptions: { enabled: applies && !!userId },
  });

  if (!applies) return null;

  const profileName = userId ? profiles?.data?.[0]?.metadata?.name : undefined;
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
