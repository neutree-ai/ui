import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import { transformClusterValues } from "./transform-cluster-values";

const sshCluster = (
  sshPrivateKey: string,
  spec: Record<string, unknown> = {},
): Cluster =>
  ({
    api_version: "v1",
    kind: "Cluster",
    metadata: { name: "c1", workspace: "default" },
    spec: {
      type: "ssh",
      config: {
        ssh_config: {
          provider: { head_ip: "1.2.3.4" },
          auth: { ssh_user: "root", ssh_private_key: sshPrivateKey },
        },
      },
      ...spec,
    },
  }) as unknown as Cluster;

const k8sCluster = (
  kubeconfig: string,
  spec: Record<string, unknown> = {},
): Cluster =>
  ({
    api_version: "v1",
    kind: "Cluster",
    metadata: { name: "c1", workspace: "default" },
    spec: {
      type: "kubernetes",
      config: {
        kubernetes_config: { kubeconfig, router: { replicas: "3" } },
      },
      ...spec,
    },
  }) as unknown as Cluster;

const storedKey = btoa("key-content\n");
const storedKubeconfig = btoa("apiVersion: v1");

describe("transformClusterValues", () => {
  it.each([
    { key: "key-content", edit: false, touched: false, sent: storedKey },
    { key: "key-content\n", edit: false, touched: false, sent: storedKey },
    { key: "", edit: true, touched: false, sent: undefined },
    { key: storedKey, edit: true, touched: false, sent: storedKey },
    { key: "key-content", edit: true, touched: true, sent: storedKey },
    { key: "", edit: true, touched: true, sent: "" },
  ])(
    "ssh key $key (edit: $edit, touched: $touched) -> $sent",
    ({ key, edit, touched, sent }) => {
      const result = transformClusterValues(
        sshCluster(key),
        edit,
        touched
          ? {
              spec: {
                config: { ssh_config: { auth: { ssh_private_key: true } } },
              },
            }
          : undefined,
      );
      expect(result.spec.config.ssh_config?.auth?.ssh_private_key).toBe(sent);
    },
  );

  it.each([
    {
      kubeconfig: "apiVersion: v1",
      edit: false,
      touched: false,
      sent: storedKubeconfig,
    },
    {
      kubeconfig: storedKubeconfig,
      edit: true,
      touched: false,
      sent: storedKubeconfig,
    },
    {
      kubeconfig: "apiVersion: v1",
      edit: true,
      touched: true,
      sent: storedKubeconfig,
    },
    { kubeconfig: "", edit: true, touched: false, sent: undefined },
    { kubeconfig: "", edit: true, touched: true, sent: "" },
  ])(
    "kubeconfig $kubeconfig (edit: $edit, touched: $touched) -> $sent",
    ({ kubeconfig, edit, touched, sent }) => {
      const result = transformClusterValues(
        k8sCluster(kubeconfig),
        edit,
        touched
          ? { spec: { config: { kubernetes_config: { kubeconfig: true } } } }
          : undefined,
      );
      expect(result.spec.config.kubernetes_config?.kubeconfig).toBe(sent);
    },
  );

  it("converts router replicas to number", () => {
    const result = transformClusterValues(k8sCluster("apiVersion: v1"));
    expect(result.spec.config.kubernetes_config?.router?.replicas).toBe(3);
  });

  it("does not encode ssh key for kubernetes type", () => {
    const cluster = k8sCluster("", {
      config: {
        ssh_config: { auth: { ssh_private_key: "should-not-encode" } },
      },
    });
    const result = transformClusterValues(cluster);
    expect(result.spec.config.ssh_config?.auth?.ssh_private_key).toBe(
      "should-not-encode",
    );
  });

  it.each([
    { cluster: k8sCluster("", { version: "v1.0.2" }), kept: true },
    { cluster: k8sCluster("", { version: "v1.0.1" }), kept: false },
    { cluster: sshCluster(""), kept: false },
  ])(
    "accelerator virtualization on $cluster.spec.type $cluster.spec.version kept: $kept",
    ({ cluster, kept }) => {
      cluster.spec.accelerator_virtualization = { enabled: true };
      const result = transformClusterValues(cluster);
      expect(result.spec.accelerator_virtualization).toEqual(
        kept ? { enabled: true } : undefined,
      );
    },
  );
});
