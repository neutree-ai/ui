import type { Page } from "@playwright/test";

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
  async deleteUser(name: string): Promise<void> {
    await this.softDelete("user_profiles", name);
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
  async deleteRole(name: string): Promise<void> {
    await this.softDelete("roles", name);
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
  async deletePolicy(name: string): Promise<void> {
    await this.softDelete("role_assignments", name);
  }

  // ── Generic soft-delete ──

  /** PATCH /{resource}?metadata->>name=eq.{name} with deletion_timestamp */
  async softDelete(resource: string, name: string): Promise<void> {
    // First get the current record to preserve existing metadata
    const records = await this.api<{ metadata: Record<string, unknown> }[]>(
      "GET",
      `/${resource}?select=metadata&metadata->>name=eq.${name}`,
    );
    if (!records?.length) return; // Already gone

    const metadata = {
      ...records[0].metadata,
      deletion_timestamp: new Date().toISOString(),
    };

    await this.api("PATCH", `/${resource}?metadata->>name=eq.${name}`, {
      metadata,
    });
  }
}
