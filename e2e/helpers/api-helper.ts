import type { Page } from "@playwright/test";

/** Module-level flag — when true the page response listener should skip logging */
let _muteApiErrors = false;

/** Whether API error logging is currently muted (used by the page fixture) */
export function isApiErrorMuted(): boolean {
  return _muteApiErrors;
}

/** Data returned by `createTestUserData` */
export interface TestUserData {
  userName: string;
  email: string;
  userId: string;
  roleName: string;
  policyName: string;
  /** Delete policy → role (retry) → user (retry) in correct dependency order */
  cleanup: () => Promise<void>;
}

/**
 * Makes API calls using the admin page's auth session via page.evaluate.
 * All requests run in the browser context to inherit the Supabase auth token.
 */
export class ApiHelper {
  constructor(readonly page: Page) {}

  /** Ensure page is on the app origin so localStorage is accessible */
  private async ensureOnAppOrigin(): Promise<void> {
    const url = this.page.url();
    if (url === "about:blank" || url === "") {
      await this.page.goto("/#/dashboard");
      await this.page.waitForURL("**/#/dashboard");
    }
  }

  /** Low-level API call via page.evaluate to inherit auth session */
  private async api<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.ensureOnAppOrigin();
    return this.page.evaluate(
      async ({ method, path, body }) => {
        // Find auth token in localStorage (Supabase stores as sb-*-auth-token)
        let token = "";
        for (const key of Object.keys(localStorage)) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const val = JSON.parse(raw);
            if (val?.access_token) {
              token = val.access_token;
              break;
            }
          } catch {}
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`/api/v1${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        if (!res.ok)
          throw new Error(
            `API ${method} ${path} failed (${res.status}): ${text}`,
          );
        return text ? JSON.parse(text) : null;
      },
      { method, path, body },
    );
  }

  // ── User CRUD ──

  /** POST /api/v1/auth/admin/users → poll for user_profile id */
  async createUser(
    name: string,
    email: string,
    password: string,
  ): Promise<string> {
    await this.api("POST", "/auth/admin/users", {
      username: name,
      email,
      password,
    });

    // The user_profile is created by a DB trigger; poll until it appears
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      const profiles = await this.api<{ id: string }[]>(
        "GET",
        `/user_profiles?select=id&metadata->>name=eq.${name}`,
      );
      if (profiles?.length > 0) {
        return profiles[0].id;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`user_profile for "${name}" did not appear after polling`);
  }

  /** Soft-delete a user_profile by name */
  async deleteUser(
    name: string,
    options?: { retries?: number },
  ): Promise<void> {
    await this.softDelete("user_profiles", name, options);
  }

  /** GET user_profile id by name */
  async getUserId(name: string): Promise<string> {
    const profiles = await this.api<{ id: string }[]>(
      "GET",
      `/user_profiles?select=id&metadata->>name=eq.${name}`,
    );
    if (!profiles?.length) throw new Error(`User "${name}" not found`);
    return profiles[0].id;
  }

  // ── Role CRUD ──

  /** POST /api/v1/roles */
  async createRole(name: string, permissions: string[]): Promise<void> {
    await this.api("POST", "/roles", {
      api_version: "v1",
      kind: "Role",
      metadata: { name },
      spec: { permissions },
    });
  }

  /** Soft-delete a role by name */
  async deleteRole(
    name: string,
    options?: { retries?: number },
  ): Promise<void> {
    await this.softDelete("roles", name, options);
  }

  // ── Policy (RoleAssignment) CRUD ──

  /** POST /api/v1/role_assignments */
  async createPolicy(
    name: string,
    userId: string,
    roleName: string,
    global = true,
  ): Promise<void> {
    await this.api("POST", "/role_assignments", {
      api_version: "v1",
      kind: "RoleAssignment",
      metadata: { name },
      spec: { user_id: userId, role: roleName, global },
    });
  }

  /** Soft-delete a role_assignment by name */
  async deletePolicy(
    name: string,
    options?: { retries?: number },
  ): Promise<void> {
    await this.softDelete("role_assignments", name, options);
  }

  // ── Workspace CRUD ──

  /** POST /api/v1/workspaces */
  async createWorkspace(name: string): Promise<void> {
    await this.api("POST", "/workspaces", {
      api_version: "v1",
      kind: "Workspace",
      metadata: { name },
    });
  }

  /** Soft-delete a workspace by name */
  async deleteWorkspace(
    name: string,
    options?: { retries?: number; force?: boolean },
  ): Promise<void> {
    await this.softDelete("workspaces", name, options);
  }

  // ── Engine CRUD ──

  /** POST /api/v1/engines */
  async createEngine(
    name: string,
    options?: { workspace?: string; version?: string },
  ): Promise<void> {
    await this.api("POST", "/engines", {
      api_version: "v1",
      kind: "Engine",
      metadata: { name, workspace: options?.workspace ?? "default" },
      spec: {
        versions: [{ version: options?.version ?? "v1.0", values_schema: {} }],
        supported_tasks: ["text-generation"],
      },
    });
  }

  /** Soft-delete an engine by name */
  async deleteEngine(
    name: string,
    options?: { retries?: number; force?: boolean },
  ): Promise<void> {
    await this.softDelete("engines", name, options);
  }

  // ── Model Catalog CRUD ──

  /** POST /api/v1/model_catalogs */
  async createModelCatalog(
    name: string,
    options?: {
      workspace?: string;
      task?: string;
      modelName?: string;
      modelVersion?: string;
      modelFile?: string;
      engine?: string;
      engineVersion?: string;
      cpu?: number;
      memory?: number;
      gpu?: number;
      replicas?: number;
      schedulerType?: string;
    },
  ): Promise<void> {
    await this.api("POST", "/model_catalogs", {
      api_version: "v1",
      kind: "ModelCatalog",
      metadata: { name, workspace: options?.workspace ?? "default" },
      spec: {
        model: {
          registry: "huggingface",
          name: options?.modelName ?? "test-model",
          version: options?.modelVersion ?? "1.0",
          task: options?.task ?? "text-generation",
          file: options?.modelFile ?? "model.safetensors",
        },
        engine: {
          engine: options?.engine ?? "vllm",
          version: options?.engineVersion ?? "v0.8.5",
        },
        resources: {
          cpu: options?.cpu ?? 1,
          memory: options?.memory ?? 1,
          gpu: options?.gpu ?? 0,
        },
        replicas: { num: options?.replicas ?? 1 },
        deployment_options: {
          scheduler: { type: options?.schedulerType ?? "roundrobin" },
        },
        variables: {},
      },
    });
  }

  /** Soft-delete a model_catalog by name */
  async deleteModelCatalog(
    name: string,
    options?: { retries?: number },
  ): Promise<void> {
    await this.softDelete("model_catalogs", name, options);
  }

  // ── API Key CRUD ──

  /** Create an API key via RPC call */
  async createApiKey(
    name: string,
    options?: { workspace?: string },
  ): Promise<{ sk_value: string }> {
    const result = await this.api<{
      status?: { sk_value?: string };
    }>("POST", "/rpc/create_api_key", {
      p_workspace: options?.workspace ?? "default",
      p_name: name,
      p_quota: 0,
    });
    return { sk_value: result?.status?.sk_value ?? "" };
  }

  /** Soft-delete an API key by name */
  async deleteApiKey(
    name: string,
    options?: { retries?: number },
  ): Promise<void> {
    await this.softDelete("api_keys", name, options);
  }

  // ── Model Registry CRUD ──

  /** POST /api/v1/model_registries */
  async createModelRegistry(
    name: string,
    options?: {
      workspace?: string;
      type?: string;
      url?: string;
      credentials?: string;
    },
  ): Promise<void> {
    const spec: Record<string, unknown> = {
      type: options?.type ?? "hugging-face",
      url: options?.url ?? "https://huggingface.co",
    };
    if (options?.credentials) spec.credentials = options.credentials;

    await this.api("POST", "/model_registries", {
      api_version: "v1",
      kind: "ModelRegistry",
      metadata: { name, workspace: options?.workspace ?? "default" },
      spec,
    });
  }

  /** Soft-delete a model_registry by name */
  async deleteModelRegistry(
    name: string,
    options?: { retries?: number; force?: boolean },
  ): Promise<void> {
    await this.softDelete("model_registries", name, options);
  }

  // ── Image Registry CRUD ──

  /** POST /api/v1/image_registries */
  async createImageRegistry(
    name: string,
    options?: {
      workspace?: string;
      url?: string;
      repository?: string;
      username?: string;
      password?: string;
    },
  ): Promise<void> {
    const authconfig: Record<string, string> = {};
    if (options?.username) authconfig.username = options.username;
    if (options?.password) authconfig.password = options.password;

    await this.api("POST", "/image_registries", {
      api_version: "v1",
      kind: "ImageRegistry",
      metadata: { name, workspace: options?.workspace ?? "default" },
      spec: {
        url: options?.url ?? "https://index.docker.io/v1",
        repository: options?.repository ?? "",
        authconfig,
      },
    });
  }

  /** Soft-delete an image_registry by name */
  async deleteImageRegistry(
    name: string,
    options?: { retries?: number; force?: boolean },
  ): Promise<void> {
    await this.softDelete("image_registries", name, options);
  }

  // ── Test data factory ──

  /**
   * Create a user + role + policy via API in one call.
   * Returns the created resource names/IDs and a `cleanup()` function
   * that deletes everything in the correct order with retry.
   */
  async createTestUserData(permissions: string[]): Promise<TestUserData> {
    const ts = Date.now();
    const userName = `test-data-${ts}`;
    const email = `test-data-${ts}@e2e.local`;
    const roleName = `test-role-${ts}`;
    const policyName = `test-policy-${ts}`;

    const userId = await this.createUser(userName, email, "Test@123456");
    await this.createRole(roleName, permissions);
    await this.createPolicy(policyName, userId, roleName, true);

    return {
      userName,
      email,
      userId,
      roleName,
      policyName,
      cleanup: async () => {
        await this.deletePolicy(policyName).catch(() => {});
        await this.deleteRole(roleName, { retries: 10 }).catch(() => {});
        await this.deleteUser(userName, { retries: 10 }).catch(() => {});
      },
    };
  }

  // ── OEM Config ──

  /**
   * Upsert the singleton OEM config (metadata.name = "default").
   * GET to check existence → POST (create) or PATCH (edit).
   */
  async upsertOemConfig(spec: {
    brand_name?: string;
    logo_base64?: string;
    logo_collapsed_base64?: string;
  }): Promise<void> {
    const existing = await this.api<{ metadata: Record<string, unknown> }[]>(
      "GET",
      "/oem_configs?metadata->>name=eq.default",
    );

    if (existing?.length) {
      await this.api("PATCH", "/oem_configs?metadata->>name=eq.default", {
        spec,
      });
    } else {
      await this.api("POST", "/oem_configs", {
        api_version: "v1",
        kind: "OemConfig",
        metadata: { name: "default" },
        spec,
      });
    }
  }

  /** Reset OEM config to defaults by clearing all spec fields to null. */
  async resetOemConfig(): Promise<void> {
    const existing = await this.api<{ metadata: Record<string, unknown> }[]>(
      "GET",
      "/oem_configs?metadata->>name=eq.default",
    );
    if (!existing?.length) return; // Nothing to reset

    await this.api("PATCH", "/oem_configs?metadata->>name=eq.default", {
      spec: {
        brand_name: null,
        logo_base64: null,
        logo_collapsed_base64: null,
      },
    });
  }

  // ── Cluster CRUD ──

  /** POST /api/v1/clusters */
  async createCluster(
    name: string,
    options?: {
      workspace?: string;
      type?: "ssh" | "kubernetes";
      headIp?: string;
      sshUser?: string;
      sshPrivateKey?: string;
      imageRegistry?: string;
      kubeconfig?: string;
    },
  ): Promise<void> {
    const type = options?.type ?? "ssh";
    const workspace = options?.workspace ?? "default";

    let config: Record<string, unknown>;
    if (type === "ssh") {
      const rawKey = options?.sshPrivateKey ?? "fake-ssh-key-for-e2e-testing";
      const base64Key = btoa(rawKey.endsWith("\n") ? rawKey : `${rawKey}\n`);
      config = {
        ssh_config: {
          provider: {
            head_ip: options?.headIp ?? "192.168.1.100",
            worker_ips: [],
          },
          auth: {
            ssh_user: options?.sshUser ?? "root",
            ssh_private_key: base64Key,
          },
        },
        model_caches: [],
      };
    } else {
      const rawKubeconfig =
        options?.kubeconfig ?? "apiVersion: v1\nkind: Config\nclusters: []";
      config = {
        kubernetes_config: {
          kubeconfig: btoa(rawKubeconfig),
          router: {
            access_mode: "LoadBalancer",
            replicas: 2,
            resources: { cpu: "1", memory: "1Gi" },
          },
        },
        model_caches: [],
      };
    }

    await this.api("POST", "/clusters", {
      api_version: "v1",
      kind: "Cluster",
      metadata: { name, workspace },
      spec: {
        type,
        image_registry: options?.imageRegistry ?? "",
        config,
      },
    });
  }

  /** Soft-delete a cluster by name */
  async deleteCluster(
    name: string,
    options?: { retries?: number; force?: boolean },
  ): Promise<void> {
    await this.softDelete("clusters", name, options);
  }

  // ── Endpoint CRUD ──

  /** POST /api/v1/endpoints */
  async createEndpoint(
    name: string,
    options?: {
      workspace?: string;
      cluster?: string;
      modelRegistry?: string;
      modelName?: string;
      engine?: string;
      engineVersion?: string;
      modelTask?: string;
      cpu?: number;
      memory?: number;
      gpu?: number;
      replicas?: number;
      schedulerType?: string;
    },
  ): Promise<void> {
    await this.api("POST", "/endpoints", {
      api_version: "v1",
      kind: "Endpoint",
      metadata: {
        name,
        workspace: options?.workspace ?? "default",
      },
      spec: {
        cluster: options?.cluster ?? "",
        model: {
          registry: options?.modelRegistry ?? "huggingface",
          name: options?.modelName ?? "test-model",
          version: "",
          task: options?.modelTask ?? "text-generation",
          file: "",
        },
        engine: {
          engine: options?.engine ?? "vllm",
          version: options?.engineVersion ?? "v0.8.5",
        },
        resources: {
          cpu: String(options?.cpu ?? 0),
          memory: String(options?.memory ?? 0),
          gpu: String(options?.gpu ?? 0),
          accelerator: null,
        },
        replicas: { num: options?.replicas ?? 1 },
        deployment_options: {
          scheduler: { type: options?.schedulerType ?? "roundrobin" },
        },
        variables: { engine_args: {} },
        env: {},
      },
    });
  }

  /** Soft-delete an endpoint by name */
  async deleteEndpoint(
    name: string,
    options?: { retries?: number; force?: boolean },
  ): Promise<void> {
    await this.softDelete("endpoints", name, options);
  }

  // ── Generic soft-delete ──

  /**
   * PATCH /{resource}?metadata->>name=eq.{name} with deletion_timestamp.
   *
   * When `retries` > 0, the call is retried on failure — useful when a
   * dependent resource was just soft-deleted and the backend GC hasn't
   * hard-deleted it yet (the reference constraint blocks deletion).
   */
  async softDelete(
    resource: string,
    name: string,
    options?: { retries?: number; retryDelayMs?: number; force?: boolean },
  ): Promise<void> {
    const retries = options?.retries ?? (options?.force ? 10 : 0);
    const delay = options?.retryDelayMs ?? 3_000;

    // Mute the page response listener during retries to avoid noisy 400 logs
    if (retries > 0) _muteApiErrors = true;
    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const records = await this.api<
            { metadata: Record<string, unknown> }[]
          >("GET", `/${resource}?select=metadata&metadata->>name=eq.${name}`);
          if (!records?.length) return; // Already gone

          const metadata: Record<string, unknown> = {
            ...records[0].metadata,
            deletion_timestamp: new Date().toISOString(),
          };
          if (options?.force) {
            metadata.annotations = {
              ...((records[0].metadata as Record<string, unknown>)
                .annotations as Record<string, string> | undefined),
              "neutree.ai/force-delete": "true",
            };
          }

          await this.api("PATCH", `/${resource}?metadata->>name=eq.${name}`, {
            metadata,
          });
          return;
        } catch (e) {
          if (attempt === retries) {
            console.warn(
              `[cleanup] Failed to delete ${resource} "${name}" after ${retries + 1} attempts: ${e instanceof Error ? e.message : e}`,
            );
            throw e;
          }
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    } finally {
      _muteApiErrors = false;
    }
  }
}
