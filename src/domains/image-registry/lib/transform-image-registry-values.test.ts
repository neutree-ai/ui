import type { ImageRegistry } from "@/domains/image-registry/types";
import { describe, expect, it } from "vitest";
import { transformImageRegistryValues } from "./transform-image-registry-values";

const makeRegistry = (
  authconfig: ImageRegistry["spec"]["authconfig"] = {},
): ImageRegistry =>
  ({
    api_version: "v1",
    kind: "ImageRegistry",
    metadata: { name: "reg1", workspace: "default" },
    spec: {
      url: "https://registry.example.com",
      repository: "repo",
      authconfig,
    },
  }) as unknown as ImageRegistry;

describe("transformImageRegistryValues", () => {
  it("preserves empty authconfig fields in create mode", () => {
    const result = transformImageRegistryValues(
      makeRegistry({ username: "", password: "" }),
    );
    expect(result.spec.authconfig.username).toBe("");
    expect(result.spec.authconfig.password).toBe("");
  });

  it("preserves non-empty authconfig fields in edit mode", () => {
    const result = transformImageRegistryValues(
      makeRegistry({ username: "user", password: "pass" }),
      true,
    );
    expect(result.spec.authconfig.username).toBe("user");
    expect(result.spec.authconfig.password).toBe("pass");
  });

  it("removes empty username and password in edit mode", () => {
    const result = transformImageRegistryValues(
      makeRegistry({ username: "", password: "" }),
      true,
    );
    expect(result.spec.authconfig.username).toBeUndefined();
    expect(result.spec.authconfig.password).toBeUndefined();
  });
});
