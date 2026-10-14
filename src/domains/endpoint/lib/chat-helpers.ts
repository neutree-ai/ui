import type { ImagePart, ModelMessage, TextPart, ToolCallPart } from "ai";

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
 * Image types the serving engines can decode. The playground sends an image's
 * bytes unchanged, so any other type (SVG, HEIC, …) fails at the engine.
 */
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
];

/** The supported types as people know them, for telling a user what to pick. */
export const SUPPORTED_IMAGE_FORMATS = "PNG, JPEG, WebP, GIF, BMP";

export const isSupportedImage = (file: File): boolean =>
  SUPPORTED_IMAGE_TYPES.includes(file.type);

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
export function filterMessagesForApi(messages: ModelMessage[]): ModelMessage[] {
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
    .filter((msg) => msg !== null) as ModelMessage[];
}

const MAX_LENGTH_STEP = 1024;

/**
 * The output budget a playground starts from for a model with this context
 * length: half of it, leaving the other half for the prompt, rounded down to
 * the slider's step. Null when the server did not report a usable length.
 */
export const playgroundMaxLength = (maxModelLen: unknown): number | null => {
  if (typeof maxModelLen !== "number" || !(maxModelLen > 1)) return null;

  const half = Math.floor(maxModelLen / 2);
  return half >= MAX_LENGTH_STEP
    ? Math.floor(half / MAX_LENGTH_STEP) * MAX_LENGTH_STEP
    : half;
};
