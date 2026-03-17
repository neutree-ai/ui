import { describe, expect, it } from "vitest";
import { buildAnthropicCurlCommand } from "./build-anthropic-curl-command";

describe("buildAnthropicCurlCommand", () => {
  it("includes service URL and model name", () => {
    const result = buildAnthropicCurlCommand(
      "https://gw.example.com",
      "claude-3-opus",
    );
    expect(result).toContain("https://gw.example.com/anthropic/v1/messages");
    expect(result).toContain('"model": "claude-3-opus"');
  });

  it("includes x-api-key header placeholder", () => {
    const result = buildAnthropicCurlCommand(
      "https://gw.example.com",
      "claude-3-opus",
    );
    expect(result).toContain("x-api-key: <your-api-key>");
  });

  it("includes Content-Type header", () => {
    const result = buildAnthropicCurlCommand(
      "https://gw.example.com",
      "claude-3-opus",
    );
    expect(result).toContain("Content-Type: application/json");
  });

  it("includes max_tokens in the request body", () => {
    const result = buildAnthropicCurlCommand(
      "https://gw.example.com",
      "claude-3-opus",
    );
    expect(result).toContain('"max_tokens": 1024');
  });

  it("handles model names with special characters", () => {
    const result = buildAnthropicCurlCommand(
      "https://gw.example.com",
      "openrouter/auto",
    );
    expect(result).toContain('"model": "openrouter/auto"');
  });
});
