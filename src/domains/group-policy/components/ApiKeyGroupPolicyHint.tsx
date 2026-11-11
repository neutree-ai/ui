import { Info } from "lucide-react";
import { useUserGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import { Link } from "@/foundation/components/Link";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Says that the owner's policies narrow the key's models further, when any
 * applies: one of a group of the owner, or one set on the owner itself. The
 * owner is a user or an application; `profileHref` links to a user owner's
 * policy when the caller can read their profile.
 */
export function ApiKeyGroupPolicyHint({
  ownerId,
  workspace,
  profileHref,
}: {
  ownerId: string;
  workspace: string;
  profileHref?: string;
}) {
  const { t } = useTranslation();
  const { policy } = useUserGroupPolicy(ownerId, workspace, ownerId !== "");
  const applies =
    !!policy &&
    (policy.groups.length > 0 ||
      (policy.subject_policies ?? []).some((own) => own.in_scope));

  if (!applies) return null;

  return (
    <p
      className="flex items-start gap-1.5 text-sm text-muted-foreground"
      data-testid="api-key-group-policy-hint"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {t("group_policies.apiKeyHint")}
        {profileHref && (
          <>
            {" "}
            <Link href={profileHref} className="text-primary hover:underline">
              {t("group_policies.viewDetails")}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
