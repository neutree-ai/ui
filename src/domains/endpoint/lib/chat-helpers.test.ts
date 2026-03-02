import type { CoreMessage } from "ai";
import { describe, expect, it } from "vitest";
import { buildUserMessageContent, filterMessagesForApi } from "./chat-helpers";

describe("buildUserMessageContent", () => {
  it("returns a string for text-only input", () => {
    const result = buildUserMessageContent("hello", []);
    expect(result).toBe("hello");
  });

  it("returns an array with text and image parts when images are present", () => {
    const result = buildUserMessageContent("hello", [
      "data:image/png;base64,abc",
    ]);
    expect(result).toEqual([
      { type: "text", text: "hello" },
      { type: "image", image: "data:image/png;base64,abc" },
    ]);
  });

  it("returns only image parts when text is empty", () => {
    const result = buildUserMessageContent("", ["data:image/png;base64,abc"]);
    expect(result).toEqual([
      { type: "image", image: "data:image/png;base64,abc" },
    ]);
  });

  it("returns an empty string for empty text and no images", () => {
    const result = buildUserMessageContent("  ", []);
    // No text (whitespace-only is trimmed away), no images → empty array
    expect(result).toEqual([]);
  });
});

describe("filterMessagesForApi", () => {
  it("keeps string content messages as-is", () => {
    const messages: CoreMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    expect(filterMessagesForApi(messages)).toEqual(messages);
  });

  it("filters out error and reasoning parts from array content", () => {
    const messages: CoreMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "response" },
          { type: "error", error: "something broke" } as never,
          { type: "reasoning", reasoning: "thinking" } as never,
        ],
      },
    ];
    const result = filterMessagesForApi(messages);
    expect(result).toEqual([
      {
        role: "assistant",
        content: [{ type: "text", text: "response" }],
      },
    ]);
  });

  it("removes messages whose content becomes empty after filtering", () => {
    const messages: CoreMessage[] = [
      {
        role: "assistant",
        content: [{ type: "error", error: "only error" } as never],
      },
    ];
    const result = filterMessagesForApi(messages);
    expect(result).toEqual([]);
  });

  it("handles mixed messages correctly", () => {
    const messages: CoreMessage[] = [
      { role: "user", content: "question" },
      {
        role: "assistant",
        content: [
          { type: "reasoning", reasoning: "let me think" } as never,
          { type: "text", text: "answer" },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "error", error: "failed" } as never],
      },
    ];
    const result = filterMessagesForApi(messages);
    expect(result).toEqual([
      { role: "user", content: "question" },
      {
        role: "assistant",
        content: [{ type: "text", text: "answer" }],
      },
    ]);
  });
});
