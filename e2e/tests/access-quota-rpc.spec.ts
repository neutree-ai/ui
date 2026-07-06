import { expect, test } from "../fixtures/base";
import { makeUser } from "../helpers/access-quota";
import type { ApiKeyLimits } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";

// TestRail suite 2420, Quota & Access Control — the limits RPC contract (quota
// policy / delete / permissions). set_api_key_limits does a whole-object replace of spec.limits
// (an omitted field clears that dimension); get_api_key_limits is owner-only;
// deleting a key drops its limits; and no user can read or edit another user's
// limits. These are pure PostgREST-RPC assertions (no gateway needed).
//
// NOTE: the stored shape is flat — `rps` / `rpm` / `concurrency` integers, not
// a windowed `rate_limits` array. Tests assert the real contract.

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test.describe("access & quota — limits RPC", () => {
  test("whole-object write, read-back, and field-omission clearing", {
    tag: "@C2727101",
  }, async ({ apiHelper, browser }) => {
    test.setTimeout(MULTI_USER_TIMEOUT);
    const user = await makeUser(apiHelper, browser);
    try {
      const model = `aq-model-${uid()}`;
      const { id } = await user.api.createApiKeyWithLimits(`aq-rpc-${uid()}`, {
        workspace: "default",
      });

      // 1) Write a full limits object.
      const full: ApiKeyLimits = {
        token_quota: { limit: 1000, period: "weekly" },
        rps: 5,
        rpm: 100,
        concurrency: 10,
        allowed_models: [model],
        disabled: false,
      };
      expect((await user.api.setApiKeyLimits(id, full)).status).toBe(200);

      let got = await user.api.getApiKeyLimits(id);
      expect(got.status).toBe(200);
      expect(got.body?.token_quota?.period).toBe("weekly");
      expect(got.body?.token_quota?.limit).toBe(1000);
      expect(got.body?.rps).toBe(5);
      expect(got.body?.rpm).toBe(100);
      expect(got.body?.concurrency).toBe(10);
      expect(got.body?.allowed_models).toEqual([model]);
      expect(got.body?.disabled).toBe(false);

      // 2) Change only the token quota by re-writing the whole (read-back) object.
      const changed: ApiKeyLimits = {
        ...full,
        token_quota: { limit: 2000, period: "weekly" },
      };
      expect((await user.api.setApiKeyLimits(id, changed)).status).toBe(200);
      got = await user.api.getApiKeyLimits(id);
      expect(got.body?.token_quota?.limit).toBe(2000);
      expect(got.body?.rps).toBe(5);
      expect(got.body?.rpm).toBe(100);
      expect(got.body?.concurrency).toBe(10);
      expect(got.body?.allowed_models).toEqual([model]);

      // 3) Write a subset — omit token_quota + rps + rpm → they clear; keep the rest.
      const subset: ApiKeyLimits = {
        concurrency: 10,
        allowed_models: [model],
        disabled: false,
      };
      expect((await user.api.setApiKeyLimits(id, subset)).status).toBe(200);
      got = await user.api.getApiKeyLimits(id);
      expect(got.body?.token_quota).toBeUndefined();
      expect(got.body?.rps).toBeUndefined();
      expect(got.body?.rpm).toBeUndefined();
      expect(got.body?.concurrency).toBe(10);
      expect(got.body?.allowed_models).toEqual([model]);
      expect(got.body?.disabled).toBe(false);
    } finally {
      await user.cleanup();
    }
  });

  test("deleting a key drops its limits policy", {
    tag: "@C2727104",
  }, async ({ apiHelper }) => {
    test.setTimeout(200_000);
    // The admin owns the key here, so its own get_api_key_limits sees it — no
    // separate user/login needed.
    const keyName = `aq-del-${uid()}`;
    const { id } = await apiHelper.createApiKeyWithLimits(keyName, {
      workspace: "default",
      limits: { token_quota: { limit: 500, period: "daily" }, rps: 3 },
    });
    // Present before deletion.
    const before = await apiHelper.getApiKeyLimits(id);
    expect(before.status).toBe(200);
    expect(before.body?.token_quota?.limit).toBe(500);

    // Force-delete so the controller hard-deletes the row (soft-delete alone
    // leaves the row queryable until GC).
    await apiHelper.deleteApiKey(keyName, { retries: 5, force: true });

    // After deletion the limits are no longer queryable (4xx or empty).
    const deadline = Date.now() + 150_000;
    let gone = false;
    while (Date.now() < deadline && !gone) {
      const after = await apiHelper.getApiKeyLimits(id);
      if (after.status >= 400 || after.body == null) gone = true;
      else await new Promise((r) => setTimeout(r, 4000));
    }
    expect(gone).toBe(true);
  });

  test("owner can read and save their own key's limits", {
    tag: "@C2727108",
  }, async ({ apiHelper, browser }) => {
    test.setTimeout(MULTI_USER_TIMEOUT);
    const user = await makeUser(apiHelper, browser);
    try {
      const { id } = await user.api.createApiKeyWithLimits(`aq-own-${uid()}`, {
        workspace: "default",
      });
      const quota = 50_000;
      const set = await user.api.setApiKeyLimits(id, {
        token_quota: { limit: quota, period: "daily" },
      });
      expect(set.status).toBe(200);
      const got = await user.api.getApiKeyLimits(id);
      expect(got.status).toBe(200);
      expect(got.body?.token_quota?.period).toBe("daily");
      expect(got.body?.token_quota?.limit).toBe(quota);
    } finally {
      await user.cleanup();
    }
  });

  test("a non-owner in the same workspace cannot see or edit another's key", {
    tag: "@C2727109",
  }, async ({ apiHelper, browser }) => {
    test.setTimeout(MULTI_USER_TIMEOUT * 2);
    const ws = `aq-ws-${uid()}`;
    await apiHelper.createWorkspace(ws);
    const userA = await makeUser(apiHelper, browser);
    const userB = await makeUser(apiHelper, browser);
    const keyAName = `aq-a-${uid()}`;
    try {
      const quotaA = 33_000;
      const { id: keyAId } = await userA.api.createApiKeyWithLimits(keyAName, {
        workspace: ws,
        limits: { token_quota: { limit: quotaA, period: "daily" } },
      });

      // B cannot find A's key by name (RLS: own keys only).
      const bId = await userB.api.getApiKeyId(keyAName, ws);
      expect(bId).toBe("");

      // B cannot change A's limits (owner check fails → 4xx).
      const setToken = await userB.api.setApiKeyLimits(keyAId, {
        token_quota: { limit: 999, period: "daily" },
      });
      expect(setToken.status).toBeGreaterThanOrEqual(400);
      const setRps = await userB.api.setApiKeyLimits(keyAId, { rps: 7 });
      expect(setRps.status).toBeGreaterThanOrEqual(400);

      // A's limit is unchanged.
      const got = await userA.api.getApiKeyLimits(keyAId);
      expect(got.body?.token_quota?.limit).toBe(quotaA);
    } finally {
      await apiHelper.deleteApiKey(keyAName, { retries: 5 }).catch(() => {});
      await userA.cleanup();
      await userB.cleanup();
      await apiHelper.deleteWorkspace(ws, { retries: 5 }).catch(() => {});
    }
  });

  test("a user cannot read or modify a key owned by another user", {
    tag: "@C2727110",
  }, async ({ apiHelper, browser }) => {
    test.setTimeout(MULTI_USER_TIMEOUT * 2);
    const wsC = `aq-wsc-${uid()}`;
    const wsD = `aq-wsd-${uid()}`;
    await apiHelper.createWorkspace(wsC);
    await apiHelper.createWorkspace(wsD);
    const userC = await makeUser(apiHelper, browser);
    const userD = await makeUser(apiHelper, browser);
    const keyCName = `aq-c-${uid()}`;
    const keyDName = `aq-d-${uid()}`;
    try {
      const { id: keyCId } = await userC.api.createApiKeyWithLimits(keyCName, {
        workspace: wsC,
        limits: { token_quota: { limit: 11_000, period: "daily" } },
      });
      const { id: keyDId } = await userD.api.createApiKeyWithLimits(keyDName, {
        workspace: wsD,
        limits: { token_quota: { limit: 22_000, period: "daily" } },
      });

      // C cannot find D's key by name.
      expect(await userC.api.getApiKeyId(keyDName, wsD)).toBe("");
      // C reading D's limits → empty (owner check returns null).
      const readD = await userC.api.getApiKeyLimits(keyDId);
      expect(
        readD.body == null || Object.keys(readD.body ?? {}).length === 0,
      ).toBe(true);
      // C writing D's limits → 4xx.
      const writeD = await userC.api.setApiKeyLimits(keyDId, {
        token_quota: { limit: 1, period: "daily" },
      });
      expect(writeD.status).toBeGreaterThanOrEqual(400);

      // C can still read its own key.
      const ownC = await userC.api.getApiKeyLimits(keyCId);
      expect(ownC.status).toBe(200);
      expect(ownC.body?.token_quota?.limit).toBe(11_000);
      // D cannot read C's key.
      const dReadsC = await userD.api.getApiKeyLimits(keyCId);
      expect(
        dReadsC.body == null || Object.keys(dReadsC.body ?? {}).length === 0,
      ).toBe(true);
    } finally {
      await apiHelper.deleteApiKey(keyCName, { retries: 5 }).catch(() => {});
      await apiHelper.deleteApiKey(keyDName, { retries: 5 }).catch(() => {});
      await userC.cleanup();
      await userD.cleanup();
      await apiHelper.deleteWorkspace(wsC, { retries: 5 }).catch(() => {});
      await apiHelper.deleteWorkspace(wsD, { retries: 5 }).catch(() => {});
    }
  });
});
