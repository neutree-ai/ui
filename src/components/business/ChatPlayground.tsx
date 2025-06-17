import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";

import { MaxLengthSelector } from "./maxlength-selector";
import { TemperatureSelector } from "./temperature-selector";
import { TopPSelector } from "./top-p-selector";
import { ChatSidebar } from "./ChatSidebar";
import { useChatState } from "@/hooks/use-chat-state";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { createOpenAI } from "@ai-sdk/openai";
import type { Endpoint } from "@/types";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "github-markdown-css/github-markdown-light.css";
import { useCustom } from "@refinedev/core";
import {
  streamText,
  type CoreMessage,
  tool,
  type ToolSet,
  jsonSchema,
  type TextPart,
  type ToolCallPart,
} from "ai";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";

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
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "submitted">(
    "idle",
  );

  const openai = createOpenAI({
    baseURL: `/api/v1/serve-proxy/${endpoint?.metadata?.name}/v1`,
    apiKey: "no",
  });

  const modelsData = useCustom({
    url: `/serve-proxy/${endpoint.metadata.name}/v1/models`,
    method: "get",
    queryOptions: {
      enabled: Boolean(endpoint.metadata.name),
    },
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const selectedModel = form.watch("model");

  // Auto-select first model when models data is loaded and has results
  useEffect(() => {
    const models = modelsData.data?.data.data || [];
    if (models.length > 0 && !selectedModel) {
      form.setValue("model", models[0].id);
    }
  }, [modelsData.data, form.setValue, selectedModel]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger scroll on messages change
  useEffect(() => {
    const outerEl = scrollAreaRef.current?.parentElement;
    outerEl?.scrollTo({
      top: outerEl?.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const onSubmit: SubmitHandler<FormValue> = async (
    { model, temperature, max_length, top_p },
    e,
  ) => {
    setStatus("submitted");
    const userMsg = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Build messages array with system message if present
    const messagesToSend: CoreMessage[] = [];

    if (systemMessage.trim()) {
      messagesToSend.push({ role: "system", content: systemMessage.trim() });
    }

    messagesToSend.push(...messages, { role: "user", content: input });

    const stream = streamText({
      model: openai(model),
      messages: messagesToSend,
      temperature,
      maxTokens: max_length,
      topP: top_p,
      tools: functions
        .filter((fn) => fn.enabled)
        .reduce<ToolSet>((prev, cur) => {
          prev[cur.name] = tool({
            description: cur.description || "",
            parameters: jsonSchema(cur.parameters),
          });
          return prev;
        }, {}),
    });

    const assistantIndex = messages.length + 1;
    setStatus("streaming");

    for await (const delta of stream.fullStream) {
      setMessages((prev) => {
        const next = [...prev];
        if (!next[assistantIndex]) {
          next[assistantIndex] = { role: "assistant", content: [] };
        }

        const contentArray = next[assistantIndex].content as Array<
          ToolCallPart | TextPart
        >;
        const lastPart = contentArray[contentArray.length - 1];

        switch (delta.type) {
          case "text-delta": {
            if (lastPart && lastPart.type === "text") {
              // append
              lastPart.text += delta.textDelta;
            } else {
              // create new text part
              contentArray.push({
                type: "text",
                text: delta.textDelta,
              });
            }
            break;
          }
          case "tool-call": {
            contentArray.push(delta);
            break;
          }
          case "step-start":
          case "step-finish":
          case "finish":
            break;
          default:
            console.log("Unhandled delta type:", delta);
        }

        return next;
      });
    }
    setStatus("idle");
  };

  const stop = () => {
    setStatus("idle");
  };

  const clearMessages = () => {
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
                  options={(modelsData.data?.data.data || []).map(
                    (v: { id: string }) => ({
                      label: v.id,
                      value: v.id,
                    }),
                  )}
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
                          message.content.map((part, partIndex) => {
                            if (part.type === "text") {
                              return (
                                <ReactMarkdown key={partIndex}>
                                  {part.text}
                                </ReactMarkdown>
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
                                    {JSON.stringify(part.args, null, 2)})
                                  </code>
                                </pre>
                              );
                            }
                            return null;
                          })}
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
                <div className="flex items-center space-x-2 justify-end">
                  {status === "streaming" ? (
                    <Button variant="secondary" onClick={stop}>
                      {t("components.playground.chat.stop")}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={
                        status === "submitted" ||
                        !input.trim() ||
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
      </form>
    </Form>
  );
}
