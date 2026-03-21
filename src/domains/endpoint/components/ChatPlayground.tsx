import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { useEffect, useRef, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useChatState } from "@/domains/endpoint/hooks/use-chat-state";
import type { Endpoint } from "@/domains/endpoint/types";
import { ChatSidebar } from "./ChatSidebar";
import { MaxLengthSelector } from "./MaxLengthSelector";
import { TemperatureSelector } from "./TemperatureSelector";
import { TopPSelector } from "./TopPSelector";
import "github-markdown-css/github-markdown-light.css";
import {
  jsonSchema,
  type ModelMessage,
  streamText,
  type ToolSet,
  tool,
} from "ai";
import { Image, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlaygroundModels } from "@/domains/endpoint/hooks/use-playground-models";
import {
  buildUserMessageContent,
  type ChatContentPart,
  filterMessagesForApi,
} from "@/domains/endpoint/lib/chat-helpers";
import { clientPostgrest } from "@/foundation/lib/api";

type FormValue = {
  model: string;
  temperature: number;
  max_length: number;
  top_p: number;
};

type ChatPlaygroundProps = {
  endpoint: Endpoint;
};

export default function ChatPlayground({ endpoint }: ChatPlaygroundProps) {
  const { t } = useTranslation();
  const { systemMessage, functions, updateSystemMessage, updateFunctions } =
    useChatState();

  const { ...form } = useForm({
    mode: "all",
    defaultValues: {
      model: "",
      temperature: 0.56,
      max_length: 256,
      top_p: 0.9,
    },
  });

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ModelMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "submitted">(
    "idle",
  );
  const [selectedImages, setSelectedImages] = useState<
    Array<{
      file: File;
      preview: string;
      dataUri: string;
    }>
  >([]);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          // Extract base64 part from data URL
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle image file selection
  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    const imagePromises = imageFiles.map(async (file) => {
      const base64 = await fileToBase64(file);
      const dataUri = `data:${file.type};base64,${base64}`;
      return {
        file,
        preview: URL.createObjectURL(file),
        dataUri,
      };
    });

    const newImages = await Promise.all(imagePromises);
    setSelectedImages((prev) => [...prev, ...newImages]);

    // Clear the input to allow selecting the same file again
    event.target.value = "";
  };

  // Remove selected image
  const removeImage = (index: number) => {
    setSelectedImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const openai = createOpenAICompatible({
    name: "ai-platform",
    baseURL: `${location.protocol}//${
      location.host
    }/api/v1/serve-proxy/${endpoint.metadata.workspace}/${endpoint.metadata.name}/v1`,
    apiKey: "no",
    headers: {
      ...clientPostgrest.headers,
    },
  });

  const { models } = usePlaygroundModels(endpoint, form);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const selectedModel = form.watch("model");

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger scroll on messages change
  useEffect(() => {
    const outerEl = scrollAreaRef.current?.parentElement;
    outerEl?.scrollTo({
      top: outerEl?.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Cleanup image URLs on unmount
  useEffect(() => {
    return () => {
      for (const image of selectedImages) {
        URL.revokeObjectURL(image.preview);
      }
    };
  }, [selectedImages]);

  const onSubmit: SubmitHandler<FormValue> = async (
    { model, temperature, max_length, top_p },
    _e,
  ) => {
    setStatus("submitted");

    // Create a new abort controller for this request
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    const userMsg = {
      role: "user" as const,
      content: buildUserMessageContent(
        input,
        selectedImages.map((img) => img.dataUri),
      ),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSelectedImages([]);

    // Build messages array with system message if present
    const messagesToSend: ModelMessage[] = [];

    if (systemMessage.trim()) {
      messagesToSend.push({ role: "system", content: systemMessage.trim() });
    }

    messagesToSend.push(...filterMessagesForApi(messages), userMsg);

    const assistantIndex = messages.length + 1;
    setStatus("streaming");

    try {
      const stream = streamText({
        model: openai(model),
        messages: messagesToSend,
        temperature,
        maxOutputTokens: max_length,
        topP: top_p,
        abortSignal: newAbortController.signal,
        tools: functions
          .filter((fn) => fn.enabled)
          .reduce<ToolSet>((prev, cur) => {
            prev[cur.name] = tool({
              description: cur.description || "",
              inputSchema: jsonSchema(cur.parameters),
            });
            return prev;
          }, {}),
      });

      for await (const delta of stream.fullStream) {
        // Check if the request was aborted
        if (newAbortController.signal.aborted) {
          break;
        }
        setMessages((prev) => {
          const next = [...prev];
          if (!next[assistantIndex]) {
            next[assistantIndex] = { role: "assistant", content: [] };
          }

          const contentArray = next[assistantIndex]
            .content as Array<ChatContentPart>;
          const lastPart = contentArray[contentArray.length - 1];

          switch (delta.type) {
            case "text-delta": {
              if (lastPart && lastPart.type === "text") {
                lastPart.text += delta.text;
              } else {
                contentArray.push({
                  type: "text",
                  text: delta.text,
                });
              }
              break;
            }
            case "reasoning-delta": {
              if (lastPart && lastPart.type === "reasoning") {
                lastPart.reasoning += delta.text;
              } else {
                contentArray.push({
                  type: "reasoning",
                  reasoning: delta.text,
                });
              }
              break;
            }
            case "tool-call": {
              contentArray.push(delta);
              break;
            }
            case "error": {
              // Handle error delta
              contentArray.push({
                type: "error",
                error: String(delta.error || "Unknown error occurred"),
              });
              break;
            }
            case "start":
            case "finish":
            case "reasoning-start":
            case "reasoning-end":
            case "text-start":
            case "text-end":
            case "source":
              break;
            default:
              console.log("Unhandled delta type:", delta);
          }

          return next;
        });
      }
    } catch (error) {
      // Handle streaming errors - don't show error if it was aborted intentionally
      if (!newAbortController.signal.aborted) {
        setMessages((prev) => {
          const next = [...prev];
          if (!next[assistantIndex]) {
            next[assistantIndex] = { role: "assistant", content: [] };
          }

          const contentArray = next[assistantIndex]
            .content as Array<ChatContentPart>;

          contentArray.push({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          });

          return next;
        });
      }
    } finally {
      // Clean up abort controller and reset status
      setAbortController(null);
      setStatus("idle");
    }
  };

  const stop = () => {
    if (abortController) {
      abortController.abort();
    }
    setStatus("idle");
  };

  const clearMessages = () => {
    stop(); // Stop any ongoing streaming
    setMessages([]);
  };

  return (
    <Form {...form}>
      <form className="h-full flex" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="h-full flex flex-1 gap-1">
          {/* Sidebar */}
          <ChatSidebar
            systemMessage={systemMessage}
            onSystemMessageChange={updateSystemMessage}
            functions={functions}
            onFunctionsChange={updateFunctions}
          >
            <Controller
              name="model"
              control={form.control}
              render={({ field }) => (
                <Combobox
                  placeholder={t("components.playground.chat.selectModel")}
                  triggerClassName="w-full"
                  popoverClassName="w-[320px]"
                  options={models}
                  {...field}
                />
              )}
            />
            <Controller
              name="temperature"
              control={form.control}
              render={({ field }) => <TemperatureSelector {...field} />}
            />
            <Controller
              name="max_length"
              control={form.control}
              render={({ field }) => <MaxLengthSelector {...field} />}
            />
            <Controller
              name="top_p"
              control={form.control}
              render={({ field }) => <TopPSelector {...field} />}
            />
          </ChatSidebar>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 ">
            <div className="flex-1 relative overflow-hidden bg-card">
              <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                      <p className="text-lg mb-2">
                        {t("components.playground.chat.chatPlaceholder")}
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className="mb-4">
                      <div className="font-bold text-sm uppercase dark:text-gray-300">
                        {message.role}
                      </div>
                      <div className="markdown-body dark:bg-transparent dark:text-gray-200 rounded-md p-2">
                        {typeof message.content === "string" && (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        )}
                        {typeof message.content !== "string" &&
                          (message.content as ChatContentPart[]).map(
                            (part, partIndex) => {
                              if (part.type === "text") {
                                return (
                                  <ReactMarkdown key={partIndex}>
                                    {part.text}
                                  </ReactMarkdown>
                                );
                              }
                              if (part.type === "image") {
                                return (
                                  <img
                                    key={partIndex}
                                    src={part.image as string}
                                    alt={t(
                                      "components.playground.chat.uploadImages",
                                    )}
                                    className="max-w-xs max-h-48 object-contain rounded border mt-2"
                                  />
                                );
                              }
                              if (part.type === "tool-call") {
                                return (
                                  <pre
                                    className="whitespace-pre-wrap break-words mt-1 rounded-md"
                                    key={partIndex}
                                  >
                                    <code>
                                      {part.toolName}(
                                      {JSON.stringify(part.input, null, 2)})
                                    </code>
                                  </pre>
                                );
                              }
                              // Handle custom error type
                              if (part.type === "error") {
                                return (
                                  <div
                                    key={partIndex}
                                    className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 mt-2"
                                  >
                                    <div className="font-medium text-sm mb-1">
                                      {t("components.playground.chat.error")}
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">
                                      {part.error}
                                    </div>
                                  </div>
                                );
                              }
                              // Handle reasoning type
                              if (part.type === "reasoning") {
                                return (
                                  <div
                                    key={partIndex}
                                    className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-500 rounded-md p-1 my-1"
                                  >
                                    <div className="font-medium text-sm mb-1 flex items-center">
                                      {t(
                                        "components.playground.chat.reasoning",
                                      ) || "Reasoning"}
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">
                                      {part.reasoning}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            },
                          )}
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
              {messages.length > 0 && (
                <div className="absolute top-4 right-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMessages}
                    className="bg-background/80 backdrop-blur"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4">
              <div className="flex flex-col space-y-2 border dark:border-gray-700 rounded-md shadow-sm p-1 bg-white dark:bg-gray-800">
                {/* Image previews */}
                {selectedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image.preview}
                          alt={t("components.playground.chat.uploadImages")}
                          className="w-16 h-16 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeImage(index)}
                          className="absolute -top-1 -right-1 rounded-full w-5 h-5 p-0 flex items-center justify-center text-xs"
                          aria-label={t(
                            "components.playground.chat.removeImage",
                          )}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Textarea
                  placeholder={
                    !selectedModel
                      ? t("components.playground.chat.selectModelFirst")
                      : t("components.playground.chat.chatPlaceholder")
                  }
                  className="flex-1 p-4 border-0 outline-none focus:ring-0 focus-visible:ring-0 focus:outline-none resize-none shadow-none bg-transparent dark:text-gray-200 dark:placeholder:text-gray-400"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={
                    ["streaming", "submitted"].includes(status) ||
                    !selectedModel
                  }
                  onKeyDown={(e) => {
                    if (e.metaKey && e.key === "Enter") {
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                />
                <div className="flex items-center space-x-2 justify-between">
                  <div className="flex items-center space-x-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-upload"
                      disabled={
                        ["streaming", "submitted"].includes(status) ||
                        !selectedModel
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("image-upload")?.click()
                      }
                      disabled={
                        ["streaming", "submitted"].includes(status) ||
                        !selectedModel
                      }
                    >
                      <Image className="w-4 h-4 mr-1" />
                      {t("components.playground.chat.images")}
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    {status === "streaming" ? (
                      <Button variant="secondary" onClick={stop}>
                        {t("components.playground.chat.stop")}
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={
                          status === "submitted" ||
                          (!input.trim() && selectedImages.length === 0) ||
                          !selectedModel
                        }
                      >
                        {t("components.playground.chat.send")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
