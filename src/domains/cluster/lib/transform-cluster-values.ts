import type { Cluster } from "@/domains/cluster/types";

/**
 * Transform cluster form values before submission.
 * - Base64-encode SSH private key (with trailing newline) and kubeconfig
 * - Convert router replicas to number
 * - In edit mode, strip empty sensitive fields to avoid overwriting backend values
 */
export function transformClusterValues(
  values: Cluster,
  isEdit = false,
): Cluster {
  const transformed = { ...values };
  const config = transformed.spec?.config;

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

  // In edit mode, remove empty sensitive fields to avoid overwriting backend config
  if (isEdit) {
    if (config.ssh_config?.auth && !config.ssh_config.auth.ssh_private_key) {
      delete config.ssh_config.auth.ssh_private_key;
    }
    if (config.kubernetes_config && !config.kubernetes_config.kubeconfig) {
      delete config.kubernetes_config.kubeconfig;
    }
  }

  return transformed;
}
