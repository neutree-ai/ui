import type { Cluster } from "@/domains/cluster/types";
import { type DirtyFields, isDirtyField } from "@/foundation/lib/dirty-fields";
import { isAcceleratorVirtualizationSupported } from "./accelerator-virtualization";

/**
 * Transform cluster form values before submission.
 * - Base64-encode SSH private key (with trailing newline) and kubeconfig
 * - Convert router replicas to number
 * - In edit mode, strip unchanged empty sensitive fields to avoid overwriting backend values
 */
export function transformClusterValues(
  values: Cluster,
  isEdit = false,
  dirtyFields?: DirtyFields,
): Cluster {
  const transformed = { ...values };
  const config = transformed.spec?.config;
  const sshPrivateKeyDirty = isDirtyField(dirtyFields, [
    "spec",
    "config",
    "ssh_config",
    "auth",
    "ssh_private_key",
  ]);
  const kubeconfigDirty = isDirtyField(dirtyFields, [
    "spec",
    "config",
    "kubernetes_config",
    "kubeconfig",
  ]);

  // Transform SSH private key for SSH type clusters
  if (config.ssh_config?.auth?.ssh_private_key && values.spec.type === "ssh") {
    if (!config.ssh_config.auth.ssh_private_key.endsWith("\n")) {
      config.ssh_config.auth.ssh_private_key += "\n";
    }
    config.ssh_config.auth.ssh_private_key = btoa(
      config.ssh_config.auth.ssh_private_key,
    );
  }
  // Transform kubeconfig for Kubernetes type clusters
  if (
    config.kubernetes_config?.kubeconfig &&
    values.spec.type === "kubernetes"
  ) {
    config.kubernetes_config.kubeconfig = btoa(
      config.kubernetes_config.kubeconfig,
    );
  }
  // Transform router replicas to number
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
  // In edit mode, remove unchanged empty sensitive fields to avoid overwriting backend config.
  if (isEdit) {
    if (
      config.ssh_config?.auth &&
      !config.ssh_config.auth.ssh_private_key &&
      !sshPrivateKeyDirty
    ) {
      delete config.ssh_config.auth.ssh_private_key;
    }
    if (
      config.kubernetes_config &&
      !config.kubernetes_config.kubeconfig &&
      !kubeconfigDirty
    ) {
      delete config.kubernetes_config.kubeconfig;
    }
  }
  return transformed;
}
