import { describe, expect, it } from "vitest";
import { buildCurlCommand } from "./build-curl-command";

describe("buildCurlCommand", () => {
  it("includes service URL and model name", () => {
    const result = buildCurlCommand("https://gw.example.com", "gpt-4o");
    expect(result).toContain("https://gw.example.com/v1/chat/completions");
    expect(result).toContain('"model": "gpt-4o"');
  });

  it("includes authorization header placeholder", () => {
    const result = buildCurlCommand("https://gw.example.com", "gpt-4o");
    expect(result).toContain("Authorization: Bearer <your-neutree-api-key>");
  });

  it("includes Content-Type header", () => {
    const result = buildCurlCommand("https://gw.example.com", "gpt-4o");
    expect(result).toContain("Content-Type: application/json");
  });

  it("handles model names with special characters", () => {
    const result = buildCurlCommand(
      "https://gw.example.com",
      "openrouter/auto",
    );
    expect(result).toContain('"model": "openrouter/auto"');
  });
});
