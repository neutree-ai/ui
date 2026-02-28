import type { Metadata } from "./basic-types";

/**
 * License phases as defined in the backend
 */
type LicensePhase = "Pending" | "Active" | "Expired" | "Invalid";

/**
 * Resource types that can be tracked in license usage
 */
type ResourceType = "GPU" | "Workspace";

/**
 * Maximum value representing unlimited resources
 */
export const MAX_UNLIMITED = -1;

/**
 * Information about a specific license
 */
type LicenseInfo = {
  /** Edition of the license */
  edition: string;
  /** Vendor of the license */
  vendor: string;
  /** Sign date timestamp (Unix timestamp in seconds) */
  sign_date: number;
  /** License type */
  license_type: string;
  /** Version of the license */
  version?: string;
  /** Period of the license in seconds. -1 means unlimited */
  period: number;
  /** Maximum GPUs allowed. -1 means unlimited */
  max_gpus: number;
  /** Serial number of the license */
  serial: string;
};

/**
 * Usage information for a specific resource type
 */
type UsedInfo = {
  /** Total used count of the resource type */
  used: number;
  /** Limit count of the resource type. -1 means unlimited */
  limit: number;
  /** Map of resource ID to used count */
  details?: Record<string, number>;
};

/**
 * Usage information for all tracked resource types
 */
type LicenseUsage = Partial<Record<ResourceType, UsedInfo>>;

/**
 * Status of the license
 */
export type LicenseStatus = {
  /** Last time the license status was updated */
  last_transition_time: string;
  /** Current phase of the license */
  phase: LicensePhase;
  /** Error message if any */
  error_message?: string;
  /** Information about the license */
  info: LicenseInfo;
  /** Current usage of the license */
  usage?: LicenseUsage;
};

/**
 * Specification of the desired behavior of the License
 */
export type LicenseSpec = {
  /** License code to be applied */
  code: string;
};

/**
 * License object
 */
export type License = {
  /** Unique ID of the license */
  id: number;
  /** API version */
  api_version: string;
  /** Kind of the object */
  kind: "License";
  /** Standard object's metadata */
  metadata: Metadata;
  /** Specification of the desired behavior of the License */
  spec: LicenseSpec;
  /** Most recently observed status of the License */
  status: LicenseStatus | null;
};
