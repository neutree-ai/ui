import { isValidIPAddress } from "@/foundation/lib/validate";

export type IpsValue = {
  head_ip: string;
  worker_ips: string[];
};

export type NodeIpsError = "required" | "invalidIP" | "duplicated";

/**
 * Check if an IP is duplicated in the worker list or matches the head IP.
 */
export function isIpDuplicated(
  ip: string,
  workerIps: string[],
  headIp: string,
): boolean {
  return workerIps.includes(ip) || ip === headIp;
}

/**
 * Validate the entire IpsValue for form-level validation (useController rules).
 * Returns the error key or null if valid.
 */
export function validateNodeIps(
  val: IpsValue | undefined,
): NodeIpsError | null {
  const { head_ip, worker_ips } = val || { head_ip: "", worker_ips: [] };
  if (!head_ip) return "required";
  if (!isValidIPAddress(head_ip)) return "invalidIP";
  if ((worker_ips || []).includes(head_ip)) return "duplicated";
  return null;
}

/**
 * Validate a single IP for real-time input feedback.
 * Returns the error key or null if valid.
 */
export function validateSingleIp(
  ip: string,
  workerIps: string[],
  headIp: string,
  isRequired = false,
): NodeIpsError | null {
  if (!isRequired && !ip) return null;
  if (!ip) return "required";
  if (!isValidIPAddress(ip)) return "invalidIP";
  if (isIpDuplicated(ip, workerIps, headIp)) return "duplicated";
  return null;
}
