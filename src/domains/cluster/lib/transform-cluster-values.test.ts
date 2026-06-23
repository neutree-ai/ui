import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import { transformClusterValues } from "./transform-cluster-values";

const makeCluster = (overrides: Record<string, unknown> = {}): Cluster =>
  ({
    api_version: "v1",
    kind: "Cluster",
    metadata: { name: "c1", workspace: "default" },
    spec: {
      type: "ssh",
      config: {
        ssh_config: {
          provider: { head_ip: "1.2.3.4" },
          auth: { ssh_user: "root", ssh_private_key: "key-content" },
        },
      },
    },
    ...overrides,
  }) as unknown as Cluster;

describe("transformClusterValues", () => {
  describe("SSH clusters", () => {
    it("base64-encodes ssh_private_key with trailing newline", () => {
      const cluster = makeCluster();
      const result = transformClusterValues(cluster);
      expect(result.spec.config.ssh_config?.auth?.ssh_private_key).toBe(
        btoa("key-content\n"),
      );
    });

    it("does not double-add trailing newline", () => {
      const cluster = makeCluster({
        spec: {
          type: "ssh",
          config: {
            ssh_config: {
              provider: { head_ip: "1.2.3.4" },
              auth: { ssh_user: "root", ssh_private_key: "key-content\n" },
            },
          },
        },
      });
      const result = transformClusterValues(cluster);
      expect(result.spec.config.ssh_config?.auth?.ssh_private_key).toBe(
        btoa("key-content\n"),
      );
    });

    it("removes unchanged empty ssh_private_key in edit mode", () => {
      const cluster = makeCluster({
        spec: {
          type: "ssh",
          config: {
            ssh_config: {
              provider: { head_ip: "1.2.3.4" },
              auth: { ssh_user: "root", ssh_private_key: "" },
            },
          },
        },
      });
      const result = transformClusterValues(cluster, true);
      expect(
        result.spec.config.ssh_config?.auth?.ssh_private_key,
      ).toBeUndefined();
    });
    it("preserves dirty empty ssh_private_key in edit mode", () => {
      const cluster = makeCluster({
        spec: {
          type: "ssh",
          config: {
            ssh_config: {
              provider: { head_ip: "1.2.3.4" },
              auth: { ssh_user: "root", ssh_private_key: "" },
            },
          },
        },
      });
      const result = transformClusterValues(cluster, true, {
        spec: {
          config: {
            ssh_config: { auth: { ssh_private_key: true } },
          },
        },
      });
      expect(result.spec.config.ssh_config?.auth?.ssh_private_key).toBe("");
    });
  });

  describe("Kubernetes clusters", () => {
    const makeK8s = () =>
      makeCluster({
        spec: {
          type: "kubernetes",
          config: {
            kubernetes_config: {
              kubeconfig: "apiVersion: v1",
              router: { replicas: "3" },
            },
          },
        },
      });

    it("base64-encodes kubeconfig", () => {
      const result = transformClusterValues(makeK8s());
      expect(result.spec.config.kubernetes_config?.kubeconfig).toBe(
        btoa("apiVersion: v1"),
      );
    });

    it("converts router replicas to number", () => {
      const result = transformClusterValues(makeK8s());
      expect(result.spec.config.kubernetes_config?.router?.replicas).toBe(3);
    });

    it("removes unchanged empty kubeconfig in edit mode", () => {
      const cluster = makeCluster({
        spec: {
          type: "kubernetes",
          config: {
            kubernetes_config: {
              kubeconfig: "",
              router: { replicas: "3" },
            },
          },
        },
      });
      const result = transformClusterValues(cluster, true);
      expect(result.spec.config.kubernetes_config?.kubeconfig).toBeUndefined();
    });
    it("preserves dirty empty kubeconfig in edit mode", () => {
      const cluster = makeCluster({
        spec: {
          type: "kubernetes",
          config: {
            kubernetes_config: {
              kubeconfig: "",
              router: { replicas: "3" },
            },
          },
        },
      });
      const result = transformClusterValues(cluster, true, {
        spec: { config: { kubernetes_config: { kubeconfig: true } } },
      });
      expect(result.spec.config.kubernetes_config?.kubeconfig).toBe("");
    });

    it("keeps accelerator virtualization config for kubernetes clusters", () => {
      const cluster = makeCluster({
        spec: {
          type: "kubernetes",
          version: "v1.1.0",
          accelerator_virtualization: { enabled: true },
          config: {
            kubernetes_config: {
              kubeconfig: "",
              router: { replicas: "3" },
            },
          },
        },
      });

      const result = transformClusterValues(cluster);

      expect(result.spec.accelerator_virtualization).toEqual({
        enabled: true,
      });
    });

    it("removes accelerator virtualization config for kubernetes clusters below v1.1.0", () => {
      const cluster = makeCluster({
        spec: {
          type: "kubernetes",
          version: "v1.0.9",
          accelerator_virtualization: { enabled: true },
          config: {
            kubernetes_config: {
              kubeconfig: "",
              router: { replicas: "3" },
            },
          },
        },
      });

      const result = transformClusterValues(cluster);

      expect(result.spec.accelerator_virtualization).toBeUndefined();
    });
  });

  it("does not encode ssh key for kubernetes type", () => {
    const cluster = makeCluster({
      spec: {
        type: "kubernetes",
        config: {
          ssh_config: {
            auth: { ssh_private_key: "should-not-encode" },
          },
        },
      },
    });
    const result = transformClusterValues(cluster);
    expect(result.spec.config.ssh_config?.auth?.ssh_private_key).toBe(
      "should-not-encode",
    );
  });

  it("removes stale accelerator virtualization config for SSH clusters", () => {
    const cluster = makeCluster({
      spec: {
        type: "ssh",
        accelerator_virtualization: { enabled: true },
        config: {
          ssh_config: {
            provider: { head_ip: "1.2.3.4" },
            auth: { ssh_user: "root", ssh_private_key: "" },
          },
        },
      },
    });

    const result = transformClusterValues(cluster);

    expect(result.spec.accelerator_virtualization).toBeUndefined();
  });
});
