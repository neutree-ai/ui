import type { Page, Route } from "@playwright/test";
import { VISUAL_NOW } from "../../src/foundation/testing/visual-fixtures";

/** What a screen's pages read from the API. */
export type MockData = {
  /** Rows by PostgREST table name; every read of the table returns all of them. */
  tables?: Record<string, unknown[]>;
  /** Bodies by path under the API root, for the routes that are not tables. */
  /** Bodies by path; a key with a query string ("path?a=b") wins for that exact query. */
  custom?: Record<string, unknown>;
  /** Results by function name, for `rpc/<name>` calls. */
  rpc?: Record<string, unknown>;
};

const API_PREFIX = "/api/v1/";

const USER_ID = "00000000-0000-4000-8000-000000000001";

const USER = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "admin@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

const base64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** A signed-in session whose token never expires within the frozen clock. */
export function visualSession() {
  const expiresAt =
    Math.floor(Date.parse(VISUAL_NOW) / 1000) + 10 * 365 * 86400;
  const token = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
    sub: USER_ID,
    role: "authenticated",
    exp: expiresAt,
  })}.signature`;
  return {
    access_token: token,
    refresh_token: "visual-refresh-token",
    token_type: "bearer",
    expires_in: 10 * 365 * 86400,
    expires_at: expiresAt,
    user: USER,
  };
}

const SHELL_TABLES: Record<string, unknown[]> = {
  oem_configs: [],
  endpoints: [],
  external_endpoints: [],
  workspaces: [
    {
      id: 1,
      api_version: "v1",
      kind: "Workspace",
      metadata: {
        name: "default",
        display_name: null,
        workspace: null,
        deletion_timestamp: null,
        creation_timestamp: "2026-01-01T00:00:00Z",
        update_timestamp: "2026-01-01T00:00:00Z",
        labels: {},
        annotations: {},
      },
      spec: {},
      status: { phase: "Created" },
    },
  ],
  user_profiles: [
    {
      id: USER_ID,
      api_version: "v1",
      kind: "UserProfile",
      metadata: {
        name: "admin",
        display_name: null,
        workspace: null,
        deletion_timestamp: null,
        creation_timestamp: "2026-01-01T00:00:00Z",
        update_timestamp: "2026-01-01T00:00:00Z",
        labels: {},
        annotations: {},
      },
      spec: { email: "admin@example.com" },
      status: { phase: "Created" },
    },
  ],
};

const SHELL_CUSTOM: Record<string, unknown> = {
  "system/info": { grafana_url: "", version: "v0.0.0-visual" },
};

// The signed-in user is an administrator: every permission check passes.
const SHELL_RPC: Record<string, unknown> = {
  has_permission: true,
  has_permission_in_any_scope: true,
  has_permission_on_team: true,
  has_permission_on_org_unit: true,
};

const json = (
  route: Route,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  });

/**
 * Serves `data` for every API call the app makes, and logs each request that
 * has no mock (answered with an empty but valid response) into `unmocked`.
 * Requests to other origins are answered empty so a page never waits on, or
 * varies with, the network.
 */
export async function installMockBackend(
  page: Page,
  appOrigin: string,
  data: MockData,
  unmocked: string[],
) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== appOrigin) {
      return route.fulfill({ status: 204, body: "" });
    }
    if (!url.pathname.startsWith(API_PREFIX)) {
      return route.continue();
    }

    const request = route.request();
    const path = url.pathname.slice(API_PREFIX.length);
    const tables = { ...SHELL_TABLES, ...data.tables };

    if (path === "auth/user") return json(route, USER);
    if (path.startsWith("auth/")) return json(route, visualSession());

    if (path.startsWith("rpc/")) {
      const name = path.slice("rpc/".length);
      const rpc = { ...SHELL_RPC, ...data.rpc };
      if (name in rpc) return json(route, rpc[name]);
    } else if (request.method() === "GET" || request.method() === "HEAD") {
      const custom = { ...SHELL_CUSTOM, ...data.custom };
      const withQuery = `${path}${url.search}`;
      if (withQuery in custom) return json(route, custom[withQuery]);
      if (path in custom) return json(route, custom[path]);
      if (path in tables) {
        const rows = tables[path];
        const range =
          rows.length === 0 ? "*/0" : `0-${rows.length - 1}/${rows.length}`;
        const single = (request.headers().accept ?? "").includes(
          "vnd.pgrst.object",
        );
        return json(route, single ? (rows[0] ?? null) : rows, {
          "content-range": range,
        });
      }
    }

    unmocked.push(`${request.method()} ${path}${url.search}`);
    return json(
      route,
      path.includes("/") || path.startsWith("rpc/") ? {} : [],
      {
        "content-range": "*/0",
      },
    );
  });
}
