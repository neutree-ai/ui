import {
  isPermissionDenied,
  translateApiErrorOr,
} from "@/foundation/lib/api-error-code";

/** Group policy write errors → i18n keys. */
export const GROUP_POLICY_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10294": "group_policies.errors.groupNotFound",
  "10299": "group_policies.errors.workspaceNotAllowed",
  "10300": "group_policies.errors.invalidSubjectKind",
  "10301": "group_policies.errors.groupFixed",
  "10302": "group_policies.errors.invalidModels",
  "10303": "group_policies.errors.invalidTokenPool",
  "10328": "group_policies.errors.scopeMismatch",
  "10329": "group_policies.errors.notInScope",
  "23505": "group_policies.errors.alreadyExists",
};

/** A PATCH or DELETE that changed no row: someone else removed the policy. */
export class GroupPolicyGoneError extends Error {
  constructor() {
    super("The group policy no longer exists");
    this.name = "GroupPolicyGoneError";
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The message for a failed group policy read or write. `deniedKey`, when
 * given, replaces the server's text for a refusal.
 */
export const groupPolicyErrorText = (
  t: Translate,
  error: unknown,
  deniedKey?: string,
): string =>
  error instanceof GroupPolicyGoneError
    ? t("group_policies.errors.gone")
    : deniedKey && isPermissionDenied(error)
      ? t(deniedKey)
      : translateApiErrorOr(
          t,
          error,
          GROUP_POLICY_ERROR_KEYS,
          "common.errors.unknown",
        );
