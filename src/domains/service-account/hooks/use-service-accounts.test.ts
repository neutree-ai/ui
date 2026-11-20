import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceAccount } from "@/domains/service-account/types";

const mutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustom: vi.fn(),
  useList: vi.fn(),
  useInvalidate: () => vi.fn(),
  useCustomMutation: () => ({ mutateAsync, isLoading: false }),
}));

import {
  useServiceAccountWrites,
  useTeamApplicationPermissionsWrites,
} from "./use-service-accounts";

const makeAccount = (
  spec: ServiceAccount["spec"] = {
    description: "Calls models",
    disabled: false,
  },
): ServiceAccount => ({
  id: "sa-1",
  metadata: {
    name: "worker",
    display_name: "Worker",
    workspace: null,
    deletion_timestamp: null,
    creation_timestamp: "2026-01-01T00:00:00Z",
    update_timestamp: "2026-01-01T00:00:00Z",
    labels: {},
    annotations: {},
  },
  team_id: 7,
  spec,
});

const requests = () =>
  mutateAsync.mock.calls.map(([{ url, method, values }]) => ({
    url,
    method,
    values,
  }));

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ data: [makeAccount()] });
});

describe("service account payloads", () => {
  it.each([
    { name: "worker", displayName: "Worker", description: "Calls models" },
    { name: "worker", displayName: "worker", description: "" },
  ])("creates an account with description '$description'", async (values) => {
    const { result } = renderHook(useServiceAccountWrites);
    await result.current.create(7, values);
    expect(requests()).toEqual([
      {
        url: "/service_accounts",
        method: "post",
        values: {
          api_version: "v1",
          kind: "ServiceAccount",
          metadata: { name: values.name, display_name: values.displayName },
          spec: { description: values.description, disabled: false },
          team_id: 7,
        },
      },
    ]);
  });

  it.each([
    { description: "Calls models", disabled: false },
    { description: "", disabled: true },
    { description: null, disabled: null },
    {},
  ])("reopens and resends the current disabled state from %j", async (spec) => {
    const { result } = renderHook(useServiceAccountWrites);
    await result.current.setDisabled(makeAccount(spec), !!spec.disabled);
    expect(requests()).toEqual([
      {
        url: "/service_accounts?id=eq.sa-1",
        method: "patch",
        values: {
          spec: {
            description: spec.description ?? "",
            disabled: !!spec.disabled,
          },
        },
      },
    ]);
  });

  it.each([true, false])(
    "sets disabled to %s without losing description",
    async (disabled) => {
      const { result } = renderHook(useServiceAccountWrites);
      await result.current.setDisabled(makeAccount(), disabled);
      expect(requests()[0].values).toEqual({
        spec: { description: "Calls models", disabled },
      });
    },
  );

  it("deletes immediately without a soft-delete payload", async () => {
    const { result } = renderHook(useServiceAccountWrites);
    await result.current.remove(makeAccount());
    expect(requests()).toEqual([
      {
        url: "/service_accounts?id=eq.sa-1",
        method: "delete",
        values: undefined,
      },
    ]);
  });
});

describe("team application permissions payloads", () => {
  it.each([true, false])(
    "saves reopened permissions with is_default %s",
    async (is_default) => {
      const current = {
        roles: ["model-invoker"],
        workspaces: null,
        is_default,
      };
      const { result } = renderHook(() =>
        useTeamApplicationPermissionsWrites(7),
      );
      await result.current.save(current, {
        roles: current.roles,
        workspaces: current.workspaces,
      });
      expect(requests()).toEqual([
        {
          url: is_default
            ? "/team_application_permissions"
            : "/team_application_permissions?team_id=eq.7",
          method: is_default ? "post" : "patch",
          values: {
            ...(is_default ? { team_id: 7 } : {}),
            roles: ["model-invoker"],
            workspaces: null,
          },
        },
      ]);
    },
  );

  it.each([
    { roles: [], workspaces: [] },
    { roles: ["reader"], workspaces: ["default"] },
    { roles: [], workspaces: null },
  ])("sends explicit permission selections %j", async (next) => {
    const { result } = renderHook(() => useTeamApplicationPermissionsWrites(7));
    await result.current.save({ ...next, is_default: false }, next);
    expect(requests()[0].values).toEqual(next);
  });

  it("resets by deleting the override without a body", async () => {
    const { result } = renderHook(() => useTeamApplicationPermissionsWrites(7));
    await result.current.reset();
    expect(requests()).toEqual([
      {
        url: "/team_application_permissions?team_id=eq.7",
        method: "delete",
        values: undefined,
      },
    ]);
  });
});
