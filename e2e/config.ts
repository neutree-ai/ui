import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

// ── Directory resolution ──

const E2E_DIR = dirname(fileURLToPath(import.meta.url));

// ── Types ──

export interface E2eConfig {
  auth: { email: string; password: string };
  testrail: { runId: string; url: string; user: string; password: string };
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
// Set E2E_PROFILE_PATH to an absolute path, or E2E_PROFILE to load from e2e/profiles/{name}.yaml

let profilePath: string;

if (process.env.E2E_PROFILE_PATH) {
  profilePath = process.env.E2E_PROFILE_PATH;
} else {
  const profileName = process.env.E2E_PROFILE || "default";
  profilePath = resolve(E2E_DIR, `profiles/${profileName}.yaml`);
}

if (!existsSync(profilePath)) {
  throw new Error(
    `E2E profile not found at ${profilePath}.\nSet E2E_PROFILE_PATH or E2E_PROFILE to a valid profile.`,
  );
}

// biome-ignore lint/suspicious/noExplicitAny: YAML profile values are dynamically typed
const raw: Record<string, any> =
  (loadYaml(readFileSync(profilePath, "utf-8")) as Record<string, unknown>) ??
  {};

// ── Resolve file content from path ──

function readFileAtPath(filePath: string): string | undefined {
  const resolved = filePath.replace(/^~/, process.env.HOME || "~");
  if (existsSync(resolved)) {
    return readFileSync(resolved, "utf-8");
  }
  return undefined;
}

// ── Build typed config ──

// biome-ignore lint/suspicious/noExplicitAny: raw YAML sections are untyped
function buildConfig(raw: Record<string, any>): E2eConfig {
  const auth = raw.auth ?? {};
  const testrail = raw.testrail ?? {};
  const ir = raw.image_registry ?? {};
  const mr = raw.model_registry ?? {};
  const sshNodes: { host: string; user: string; key_file?: string }[] =
    raw.ssh_nodes ?? [];
  const k8s = raw.kubernetes ?? {};
  const eng = raw.engine ?? {};
  const model = raw.model ?? {};
  const mc = raw.model_cache ?? {};

  const headNode = sshNodes[0] ?? {};

  const cfg: Omit<E2eConfig, "features"> = {
    auth: {
      email: auth.email ?? "admin@example.com",
      password: auth.password ?? "admin",
    },
    testrail: {
      runId: String(process.env.TESTRAIL_RUN_ID || testrail.run_id || ""),
      url: testrail.url ?? "",
      user: testrail.user ?? "",
      password: testrail.password ?? "",
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
      headIp: headNode.host ?? "192.168.1.100",
      workerIps: sshNodes.slice(1).map((n) => n.host),
      sshUser: headNode.user ?? "root",
      sshPrivateKey:
        (headNode.key_file ? readFileAtPath(headNode.key_file) : undefined) ??
        "fake-ssh-key-for-e2e-testing",
    },
    k8sCluster: {
      kubeconfig:
        (k8s.kubeconfig ? readFileAtPath(k8s.kubeconfig) : undefined) ??
        "apiVersion: v1\nkind: Config\nclusters: []",
      routerAccessMode: k8s.router_access_mode ?? "LoadBalancer",
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
      hostPath: mc.host_path ?? "/data/models",
      nfsServer: mc.nfs_server ?? "",
      nfsPath: mc.nfs_path ?? "",
      pvcStorageClass: mc.pvc_storage_class ?? "",
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
