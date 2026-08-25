import { describe, expect, it } from "vitest";
import type { RegistryModel } from "@/foundation/types/model-types";
import {
  registryModelDefaultVersion,
  registryModelLabel,
} from "./registry-model-display";

const version = (name: string, alias?: string) => ({
  name,
  creation_time: "",
  ...(alias ? { alias } : {}),
});

const model = (name: string, versions: RegistryModel["versions"]) =>
  ({ name, versions }) as RegistryModel;

describe("registryModelLabel", () => {
  it("shows the alias when a version carries one", () => {
    expect(
      registryModelLabel(model("Qwen/Qwen3-8B", [version("v1", "qwen")])),
    ).toBe("qwen");
  });

  it("falls back to the physical name", () => {
    // Public registries never carry aliases and take this path.
    expect(registryModelLabel(model("Qwen/Qwen3-8B", [version("v1")]))).toBe(
      "Qwen/Qwen3-8B",
    );
    expect(registryModelLabel(model("Qwen/Qwen3-8B", []))).toBe(
      "Qwen/Qwen3-8B",
    );
  });

  it("takes the first alias when several versions carry one", () => {
    expect(
      registryModelLabel(
        model("m", [
          version("v1"),
          version("v2", "second"),
          version("v3", "third"),
        ]),
      ),
    ).toBe("second");
  });

  it("ignores an empty alias rather than showing a blank label", () => {
    expect(registryModelLabel(model("m", [version("v1", "")]))).toBe("m");
  });
});

describe("registryModelDefaultVersion", () => {
  it("takes the first version the registry reported", () => {
    expect(
      registryModelDefaultVersion(model("m", [version("v2"), version("v1")])),
    ).toBe("v2");
  });

  it("is undefined when the registry reported no versions", () => {
    expect(registryModelDefaultVersion(model("m", []))).toBeUndefined();
  });
});
