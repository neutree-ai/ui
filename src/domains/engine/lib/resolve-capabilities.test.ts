import { describe, expect, it } from "vitest";
import type {
  EngineCapabilities,
  EngineVersion,
  PlaygroundMode,
} from "@/domains/engine/types";
import { resolvePlayground } from "./resolve-capabilities";

function makeVersion(capabilities?: EngineCapabilities | null): EngineVersion {
  return {
    version: "v1",
    values_schema: {},
    capabilities,
  };
}

function playgroundVersion(
  enabled: boolean,
  modes?: PlaygroundMode[],
): EngineVersion {
  return makeVersion({ playground: { enabled, modes } });
}

describe("resolvePlayground", () => {
  describe("undeclared falls back to the pre-protocol behaviour", () => {
    // These are the cases that matter on upgrade: engines registered before the
    // capability protocol carry no declaration and must keep working.
    const undeclared: [string, EngineVersion | undefined][] = [
      ["engine version not resolved yet", undefined],
      ["no capabilities at all", makeVersion()],
      ["null capabilities", makeVersion(null)],
      ["capabilities present but playground undeclared", makeVersion({})],
      [
        "another capability declared, playground undeclared",
        makeVersion({ metrics_export: { enabled: false } }),
      ],
    ];

    it.each(undeclared)("%s: shows the tab", (_name, version) => {
      expect(resolvePlayground(version, "text-generation").enabled).toBe(true);
    });

    it.each(undeclared)(
      "%s: derives the surface from the task",
      (_name, version) => {
        expect(resolvePlayground(version, "text-embedding").mode).toBe(
          "embedding",
        );
        expect(resolvePlayground(version, "text-rerank").mode).toBe("rerank");
        expect(resolvePlayground(version, "text-generation").mode).toBe("chat");
        expect(resolvePlayground(version, undefined).mode).toBe("chat");
      },
    );
  });

  it("hides the tab when the engine declares it unsupported", () => {
    expect(
      resolvePlayground(playgroundVersion(false), "text-generation"),
    ).toEqual({ enabled: false, mode: null });
  });

  it("ignores declared modes when disabled", () => {
    expect(
      resolvePlayground(playgroundVersion(false, ["chat"]), "text-generation"),
    ).toEqual({ enabled: false, mode: null });
  });

  it("treats an empty mode list as no narrowing", () => {
    expect(
      resolvePlayground(playgroundVersion(true, []), "text-rerank"),
    ).toEqual({
      enabled: true,
      mode: "rerank",
    });
  });

  it("uses the task's surface when the engine declares it", () => {
    expect(
      resolvePlayground(
        playgroundVersion(true, ["chat", "embedding"]),
        "text-embedding",
      ),
    ).toEqual({ enabled: true, mode: "embedding" });
  });

  it("prefers the declaration over the task when they disagree", () => {
    // A document-extraction engine (the MinerU case) serves a chat playground
    // while its task is nothing the console knows about. The declaration wins.
    expect(
      resolvePlayground(
        playgroundVersion(true, ["chat"]),
        "document-extraction",
      ),
    ).toEqual({ enabled: true, mode: "chat" });

    // Same rule when the task maps to a surface the engine did not declare:
    // showing the rerank playground for an engine that cannot rerank would be
    // worse than showing the one it says it has.
    expect(
      resolvePlayground(playgroundVersion(true, ["embedding"]), "text-rerank"),
    ).toEqual({ enabled: true, mode: "embedding" });
  });
});
