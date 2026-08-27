import { describe, expect, it } from "vitest";
import {
  imageReferencesFrom,
  namespaceSuggestions,
} from "@/domains/endpoint/lib/image-namespaces";

describe("imageReferencesFrom", () => {
  it("reads the image a Flex endpoint was given", () => {
    const references = imageReferencesFrom(
      [
        {
          spec: {
            variables: { engine_args: { image: "vllm/vllm-openai:v1" } },
          },
        },
        { spec: { variables: { engine_args: { command: "serve" } } } },
        { spec: { variables: null } },
        {},
      ],
      [],
    );

    expect(references).toEqual(["vllm/vllm-openai:v1"]);
  });

  it("reads the images an engine version registers, across accelerators", () => {
    const references = imageReferencesFrom(
      [],
      [
        {
          spec: {
            versions: [
              {
                images: {
                  cpu: { image_name: "neutree/vllm", tag: "v1" },
                  cuda: { image_name: "neutree/vllm-cuda", tag: "v1" },
                },
              },
              { images: {} },
              {},
            ],
          },
        },
        { spec: {} },
      ],
    );

    expect(references).toEqual(["neutree/vllm", "neutree/vllm-cuda"]);
  });
});

describe("namespaceSuggestions", () => {
  it("always offers Docker Hub's official namespace first", () => {
    // `nginx` is really `library/nginx`, so someone reaching for an official
    // image needs this one and would otherwise have to know the convention.
    expect(namespaceSuggestions([], "docker.io")).toEqual(["library"]);
  });

  it("adds the namespaces this deployment already uses", () => {
    // Read from what exists in the installation rather than from a table of
    // names that goes stale.
    expect(
      namespaceSuggestions(
        ["vllm/vllm-openai:v1", "neutree/vllm-cuda", "docker.io/acme/thing"],
        "docker.io",
      ),
    ).toEqual(["library", "acme", "neutree", "vllm"]);
  });

  it("does not repeat the official namespace when it is also in use", () => {
    expect(namespaceSuggestions(["library/nginx:latest"], "docker.io")).toEqual(
      ["library"],
    );
  });

  it("ignores references belonging to some other registry", () => {
    // Their first segment is a host, not a namespace; offering it would send
    // the next request somewhere that cannot answer.
    expect(
      namespaceSuggestions(
        ["registry.example.com/team/inner/x:v1", "other.io/acme/thing"],
        "docker.io",
      ),
    ).toEqual(["library"]);
  });

  it("ignores a bare repository, which names no namespace", () => {
    expect(
      namespaceSuggestions(["nginx:latest", "redis"], "docker.io"),
    ).toEqual(["library"]);
  });

  it("does not mistake a registry port for a tag", () => {
    // Only the last path segment can carry a tag, so the port survives the
    // prefix being taken off and `team` is read as the namespace it is.
    expect(
      namespaceSuggestions(["registry:5000/team/x"], "registry:5000"),
    ).toEqual(["library", "team"]);
  });

  it("deduplicates and sorts what it found", () => {
    expect(
      namespaceSuggestions(
        ["vllm/a:1", "vllm/b:2", "acme/c", "vllm/a:3"],
        "docker.io",
      ),
    ).toEqual(["library", "acme", "vllm"]);
  });
});
