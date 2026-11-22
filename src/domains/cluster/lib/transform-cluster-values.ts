import type { Cluster } from "@/domains/cluster/types";
import {
  isTouchedField,
  omitEmptyUntouched,
  type TouchedFields,
} from "@/foundation/role/touched-fields";
import { zcacheSpec } from "../types";
import { isAcceleratorVirtualizationSupported } from "./accelerator-virtualization";

/**
 * Transform cluster form values before submission.
 * - Base64-encode SSH private key (with trailing newline) and kubeconfig
 * - Convert router replicas to number
 * - In edit mode, strip unchanged empty sensitive fields to avoid overwriting backend values
 *
 * The API stores both secrets base64-encoded and never returns them, so an
 * edit form starts with them empty. Encoding applies only to values the user
 * entered (create mode, or touched in edit mode).
 */
export function transformClusterValues(
  values: Cluster,
  isEdit = false,
  touchedFields?: TouchedFields,
): Cluster {
  const transformed = { ...values, spec: { ...values.spec } };
  const cache = values.spec.cache;
  if (cache?.provider === "zcache") {
    const options = zcacheSpec(values);
    if (
      values.spec.type !== "kubernetes" ||
      typeof options?.enabled !== "boolean"
    ) {
      delete transformed.spec.cache;
    } else {
      transformed.spec.cache = {
        provider: "zcache",
        options: {
          ...(options.version ? { version: options.version } : {}),
          enabled: options.enabled,
          l1_size_gib: Number(options.l1_size_gib ?? 0),
          target_nodes: [...(options.target_nodes ?? [])],
        },
      };
    }
  }
  const config = transformed.spec.config;
  const sshPrivateKeyTouched = isTouchedField(touchedFields, [
    "spec",
    "config",
    "ssh_config",
    "auth",
    "ssh_private_key",
  ]);
  const kubeconfigTouched = isTouchedField(touchedFields, [
    "spec",
    "config",
    "kubernetes_config",
    "kubeconfig",
  ]);

  if (
    config.ssh_config?.auth?.ssh_private_key &&
    values.spec.type === "ssh" &&
    (!isEdit || sshPrivateKeyTouched)
  ) {
    if (!config.ssh_config.auth.ssh_private_key.endsWith("\n")) {
      config.ssh_config.auth.ssh_private_key += "\n";
    }
    config.ssh_config.auth.ssh_private_key = btoa(
      config.ssh_config.auth.ssh_private_key,
    );
  }
  if (
    config.kubernetes_config?.kubeconfig &&
    values.spec.type === "kubernetes" &&
    (!isEdit || kubeconfigTouched)
  ) {
    config.kubernetes_config.kubeconfig = btoa(
      config.kubernetes_config.kubeconfig,
    );
  }
  if (config.kubernetes_config?.router?.replicas) {
    config.kubernetes_config.router.replicas = Number(
      config.kubernetes_config.router.replicas,
    );
  }
  if (
    values.spec.type !== "kubernetes" ||
    !isAcceleratorVirtualizationSupported(values.spec.version)
  ) {
    delete transformed.spec.accelerator_virtualization;
  }
  if (isEdit) {
    omitEmptyUntouched(
      config.ssh_config?.auth,
      ["spec", "config", "ssh_config", "auth"],
      ["ssh_private_key"],
      touchedFields,
    );
    omitEmptyUntouched(
      config.kubernetes_config,
      ["spec", "config", "kubernetes_config"],
      ["kubeconfig"],
      touchedFields,
    );
  }
  return transformed;
}
