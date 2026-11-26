import { expect, it } from "vitest";
import type { ApiKey } from "@/domains/api-key/types";
import { apiKeyShowContext } from "./api-key-display-show";

const key = (owner: Partial<ApiKey>) =>
  ({ metadata: { workspace: "ws-a" }, spec: {}, ...owner }) as ApiKey;

it("looks up Projects and names the user for a personal key", () => {
  expect(apiKeyShowContext(key({ user_id: "u1" }))).toMatchObject({
    projectsWorkspace: "ws-a",
    userId: "u1",
    policyOwnerId: "u1",
  });
});

it("looks up no Projects and names the application for an application's key", () => {
  expect(
    apiKeyShowContext(key({ user_id: null, service_account_id: "sa-1" })),
  ).toMatchObject({
    projectsWorkspace: undefined,
    userId: undefined,
    policyOwnerId: "sa-1",
  });
});

it("reads nothing before the key loads", () => {
  expect(apiKeyShowContext(undefined)).toMatchObject({
    projectsWorkspace: undefined,
    policyOwnerId: undefined,
    workspace: "",
    projectId: null,
    description: "",
  });
});
