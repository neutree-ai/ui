import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

// ── Directory resolution ──

const E2E_DIR = dirname(fileURLToPath(import.meta.url));

// ── Types ──

export interface E2eConfig {
  auth: { email: string; password: string };
  imageRegistry: {
    url: string;
    repository: string;
    username: string;
    password: string;
  };
  modelRegistry: { type: string; url: string; credentials: string };
  sshCluster: {
    headIp: string;
    workerIps: string[];
    sshUser: string;
    sshPrivateKey: string;
  };
  k8sCluster: { kubeconfig: string; routerAccessMode: string };
  engine: { name: string; version: string };
  model: { name: string; version: string; file: string; task: string };
  modelCache: {
    hostPath: string;
    nfsServer: string;
    nfsPath: string;
    pvcStorageClass: string;
  };
  features: FeatureFlags;
}

export interface FeatureFlags {
  /** kubeconfig is not the fake placeholder */
  hasRealK8sCluster: boolean;
  /** username + password are non-empty */
  hasRealImageRegistry: boolean;
  /** credentials are non-empty */
  hasRealModelRegistry: boolean;
  /** sshPrivateKey is not the fake placeholder */
  hasRealSshCluster: boolean;
  /** nfsServer or pvcStorageClass are non-empty */
  hasRealModelCache: boolean;
  /** model.name is not the placeholder "test-model" */
  hasRealModel: boolean;
}

// ── Profile loading ──

const profileName = process.env.E2E_PROFILE || "default";
const profilePath = resolve(E2E_DIR, `profiles/${profileName}.yaml`);

if (!existsSync(profilePath)) {
  throw new Error(
    `E2E profile "${profileName}" not found at ${profilePath}.\nSet E2E_PROFILE to a valid profile name or ensure the file exists.`,
  );
}

// biome-ignore lint/suspicious/noExplicitAny: YAML profile values are dynamically typed
const raw: Record<string, any> =
  (loadYaml(readFileSync(profilePath, "utf-8")) as Record<string, unknown>) ??
  {};

// ── File references (resolve external files relative to profile) ──

if (raw.k8sCluster?.kubeconfigFile) {
  const kcPath = resolve(dirname(profilePath), raw.k8sCluster.kubeconfigFile);
  raw.k8sCluster.kubeconfig = readFileSync(kcPath, "utf-8");
  delete raw.k8sCluster.kubeconfigFile;
}

if (raw.sshCluster?.sshPrivateKeyFile) {
  const keyPath = resolve(
    dirname(profilePath),
    raw.sshCluster.sshPrivateKeyFile,
  );
  raw.sshCluster.sshPrivateKey = readFileSync(keyPath, "utf-8");
  delete raw.sshCluster.sshPrivateKeyFile;
}

// ── Build typed config ──

// biome-ignore lint/suspicious/noExplicitAny: raw YAML sections are untyped
function buildConfig(raw: Record<string, any>): E2eConfig {
  const ir = raw.imageRegistry ?? {};
  const mr = raw.modelRegistry ?? {};
  const ssh = raw.sshCluster ?? {};
  const k8s = raw.k8sCluster ?? {};
  const eng = raw.engine ?? {};
  const model = raw.model ?? {};
  const mc = raw.modelCache ?? {};

  const cfg: Omit<E2eConfig, "features"> = {
    auth: {
      email: process.env.E2E_EMAIL || "admin@example.com",
      password: process.env.E2E_PASSWORD || "admin",
    },
    imageRegistry: {
      url: ir.url ?? "https://index.docker.io/v1",
      repository: ir.repository ?? "",
      username: ir.username ?? "",
      password: ir.password ?? "",
    },
    modelRegistry: {
      type: mr.type ?? "hugging-face",
      url: mr.url ?? "https://huggingface.co",
      credentials: mr.credentials ?? "",
    },
    sshCluster: {
      headIp: ssh.headIp ?? "192.168.1.100",
      workerIps: ssh.workerIps ?? [],
      sshUser: ssh.sshUser ?? "root",
      sshPrivateKey: ssh.sshPrivateKey ?? "fake-ssh-key-for-e2e-testing",
    },
    k8sCluster: {
      kubeconfig:
        k8s.kubeconfig ?? "apiVersion: v1\nkind: Config\nclusters: []",
      routerAccessMode: k8s.routerAccessMode ?? "LoadBalancer",
    },
    engine: {
      name: eng.name ?? "vllm",
      version: eng.version ?? "v0.8.5",
    },
    model: {
      name: model.name ?? "test-model",
      version: model.version ?? "1.0",
      file: model.file ?? "model.safetensors",
      task: model.task ?? "text-generation",
    },
    modelCache: {
      hostPath: mc.hostPath ?? "/data/models",
      nfsServer: mc.nfsServer ?? "",
      nfsPath: mc.nfsPath ?? "",
      pvcStorageClass: mc.pvcStorageClass ?? "",
    },
  };

  const features: FeatureFlags = {
    hasRealK8sCluster:
      cfg.k8sCluster.kubeconfig !==
      "apiVersion: v1\nkind: Config\nclusters: []",
    hasRealImageRegistry: !!(
      cfg.imageRegistry.username && cfg.imageRegistry.password
    ),
    hasRealModelRegistry: !!cfg.modelRegistry.credentials,
    hasRealSshCluster:
      cfg.sshCluster.sshPrivateKey !== "fake-ssh-key-for-e2e-testing",
    hasRealModelCache: !!(
      cfg.modelCache.nfsServer || cfg.modelCache.pvcStorageClass
    ),
    hasRealModel: cfg.model.name !== "test-model",
  };

  return { ...cfg, features };
}

export const config: E2eConfig = buildConfig(raw);
