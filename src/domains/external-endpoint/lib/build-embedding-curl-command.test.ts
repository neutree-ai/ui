import { describe, expect, it } from "vitest";
import { buildEmbeddingCurlCommand } from "./build-embedding-curl-command";

describe("buildEmbeddingCurlCommand", () => {
  it("includes service URL with /v1/embeddings path", () => {
    const result = buildEmbeddingCurlCommand(
      "https://gw.example.com",
      "text-embedding-3-small",
    );
    expect(result).toContain("https://gw.example.com/v1/embeddings");
  });

  it("includes model name", () => {
    const result = buildEmbeddingCurlCommand(
      "https://gw.example.com",
      "text-embedding-3-small",
    );
    expect(result).toContain('"model": "text-embedding-3-small"');
  });

  it("includes authorization header placeholder", () => {
    const result = buildEmbeddingCurlCommand(
      "https://gw.example.com",
      "text-embedding-3-small",
    );
    expect(result).toContain("Authorization: Bearer <your-neutree-api-key>");
  });

  it("includes embedding-specific fields", () => {
    const result = buildEmbeddingCurlCommand(
      "https://gw.example.com",
      "text-embedding-3-small",
    );
    expect(result).toContain('"input": "Your text string goes here"');
    expect(result).toContain('"encoding_format": "float"');
  });

  it("handles model names with special characters", () => {
    const result = buildEmbeddingCurlCommand(
      "https://gw.example.com",
      "google/gemini-embedding-001",
    );
    expect(result).toContain('"model": "google/gemini-embedding-001"');
  });
});
