import { describe, expect, it } from "vitest";
import {
  imageRegistryPrefix,
  qualifyReference,
  relativeRepository,
} from "@/foundation/lib/image-reference";

describe("imageRegistryPrefix", () => {
  it("composes the host and the project the registry is scoped to", () => {
    expect(
      imageRegistryPrefix({
        url: "https://registry.example.com",
        repository: "team",
      }),
    ).toBe("registry.example.com/team");
  });

  it("keeps a port and drops the scheme", () => {
    expect(
      imageRegistryPrefix({
        url: "http://registry.example.com:5000/",
        repository: " /team/ ",
      }),
    ).toBe("registry.example.com:5000/team");
  });

  it("leaves a URL that already carries a path alone", () => {
    // The server refuses to combine the two rather than concatenating them, so
    // guessing a combination here would show a prefix nothing pulls from.
    expect(
      imageRegistryPrefix({
        url: "registry.example.com/team",
        repository: "other",
      }),
    ).toBe("registry.example.com/team");
  });

  it("survives a registry with nothing filled in", () => {
    expect(imageRegistryPrefix({})).toBe("");
  });
});

describe("relativeRepository", () => {
  it("takes the registry's prefix off a fully-qualified repository", () => {
    expect(
      relativeRepository(
        "registry.example.com/team/inner/x",
        "registry.example.com/team",
      ),
    ).toBe("inner/x");
  });

  it("leaves a bare name alone", () => {
    // What this field has always accepted, and what the suggestion routes have
    // always assumed they were given.
    expect(relativeRepository("inner/x", "registry.example.com/team")).toBe(
      "inner/x",
    );
  });

  it("leaves a repository in a different registry alone", () => {
    expect(
      relativeRepository("other.example.com/x", "registry.example.com/team"),
    ).toBe("other.example.com/x");
  });

  it("does not mistake a prefix that is only a name prefix for a path one", () => {
    expect(
      relativeRepository(
        "registry.example.com/teams/x",
        "registry.example.com/team",
      ),
    ).toBe("registry.example.com/teams/x");
  });
});

describe("qualifyReference", () => {
  it("writes the registry host into the value", () => {
    // The value is used verbatim by whatever runs the workload. A relative one
    // resolves against Docker Hub rather than the registry it was browsed in.
    expect(qualifyReference("inner/x", "v1", "registry.example.com/team")).toBe(
      "registry.example.com/team/inner/x:v1",
    );
  });

  it("does not double the prefix on a repository that already carries it", () => {
    expect(
      qualifyReference(
        "registry.example.com/team/inner/x",
        "v1",
        "registry.example.com/team",
      ),
    ).toBe("registry.example.com/team/inner/x:v1");
  });

  it("leaves the tag off when none was chosen", () => {
    expect(qualifyReference("inner/x", "", "registry.example.com/team")).toBe(
      "registry.example.com/team/inner/x",
    );
  });

  it("falls back to the bare repository when the registry has no prefix", () => {
    expect(qualifyReference("inner/x", "v1", "")).toBe("inner/x:v1");
  });
});
