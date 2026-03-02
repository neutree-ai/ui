import type { CoreMessage, ImagePart, TextPart, ToolCallPart } from "ai";

// Custom error part type for handling errors in chat
export type ErrorPart = {
  type: "error";
  error: string;
};

// Custom reasoning part type for handling reasoning in chat
export type ReasoningPart = {
  type: "reasoning";
  reasoning: string;
};

// Extended content part type that includes error handling and reasoning
export type ChatContentPart =
  | TextPart
  | ToolCallPart
  | ImagePart
  | ErrorPart
  | ReasoningPart;

/**
 * Build user message content from text input and image data URIs.
 *
 * Returns a plain string when the message is text-only (no images),
 * otherwise returns an array of TextPart / ImagePart.
 */
export function buildUserMessageContent(
  input: string,
  imageDataUris: string[],
): string | Array<TextPart | ImagePart> {
  const parts: Array<TextPart | ImagePart> = [];

  if (input.trim()) {
    parts.push({ type: "text", text: input });
  }

  for (const uri of imageDataUris) {
    parts.push({ type: "image", image: uri });
  }

  // Keep simple string format for text-only messages
  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text;
  }

  return parts;
}

/**
 * Filter out error and reasoning parts from messages before sending to the API.
 *
 * - String content messages are kept as-is.
 * - Array content messages have `error` and `reasoning` parts removed.
 * - Messages whose content becomes empty after filtering are dropped entirely.
 */
export function filterMessagesForApi(messages: CoreMessage[]): CoreMessage[] {
  return messages
    .map((msg) => {
      if (typeof msg.content === "string") {
        return msg;
      }

      const filteredContent = (msg.content as ChatContentPart[]).filter(
        (part) => part.type !== "error" && part.type !== "reasoning",
      );

      if (filteredContent.length === 0) {
        return null;
      }

      return {
        ...msg,
        content: filteredContent,
      };
    })
    .filter((msg) => msg !== null) as CoreMessage[];
}
