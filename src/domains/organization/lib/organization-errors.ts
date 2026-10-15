import { translateApiError } from "@/foundation/lib/api-error-code";

/**
 * OrgUnit, Team and member write errors → i18n keys. They come from the
 * write triggers of the organization tables.
 */
export const ORGANIZATION_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10270": "organization.errors.noWorkspace",
  "10271": "organization.errors.identityRequired",
  "10272": "organization.errors.unknownIdentitySource",
  "10273": "organization.errors.identityImmutable",
  "10274": "organization.errors.invalidPhase",
  "10275": "organization.errors.invalidParent",
  "10276": "organization.errors.cycle",
  "10277": "organization.errors.inactiveOrgUnit",
  "10278": "organization.errors.externalUserOrgUnit",
  "10287": "organization.errors.globalAssignerOnly",
  "10288": "organization.errors.reservedTeamName",
  "10289": "organization.errors.syncedTeamReadOnly",
  "10290": "organization.errors.syncedTeamMembersReadOnly",
  "10291": "organization.errors.manualTeamAlwaysActive",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const organizationErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined => translateApiError(t, error, ORGANIZATION_ERROR_KEYS);
