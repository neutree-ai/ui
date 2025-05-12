import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";

import { MaxLengthSelector } from "./maxlength-selector";
import { TemperatureSelector } from "./temperature-selector";
import { TopPSelector } from "./top-p-selector";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { createOpenAI } from "@ai-sdk/openai";
import type { Endpoint } from "@/types";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "github-markdown-css/github-markdown-light.css";
import { useCustom } from "@refinedev/core";
import { streamText, type CoreMessage } from "ai";

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
    const userMsg = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const stream = streamText({
      model: openai(model),
      messages: [...messages, { role: "user", content: input }],
      temperature,
      maxTokens: max_length,
      topP: top_p,
    });

    const assistantIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    for await (const delta of stream.textStream) {
      setMessages((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: "assistant",
          content: next[assistantIndex].content + (delta ?? ""),
        };
        return next;
      });
    }
  };

  return (
    <Form {...form}>
      <form className="h-full flex-col" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="h-full">
          {/* <div className=" container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0">
            <div className="ml-auto flex w-full space-x-2 sm:justify-end">
            <PresetSelector presets={presets} />
            <PresetSave />
            <div className="space-x-2 md:flex">
              <CodeViewer />
              <PresetShare />
            </div>
            <PresetActions />
          </div>
          </div> */}
          <div className="h-full">
            <div className="container h-full py-6">
              <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_300px]">
                <div className="flex-col space-y-4 sm:flex md:order-2 h-full">
                  <Controller
                    name="model"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        placeholder="Select a model"
                        triggerClassName="sm:w-[300px]"
                        popoverClassName="w-[300px]"
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
                </div>
                <div className="md:order-1 relative w-full space-y-2 h-full overflow-auto">
                  <ScrollArea className="p-2" ref={scrollAreaRef}>
                    {messages.map((message, index) => (
                      <div key={index}>
                        <div className="font-bold">{message.role}</div>
                        <div className="markdown-body">
                          <ReactMarkdown>
                            {typeof message.content === "string"
                              ? message.content
                              : ""}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                  <div className="flex flex-col space-y-2 border rounded-md shadow-sm p-1 sticky bottom-2 right-0 left-0 bg-white">
                    <Textarea
                      placeholder={
                        !form.getValues().model
                          ? "Select a model first"
                          : "Chat with your AI model..."
                      }
                      className="flex-1 p-4 border-0 outline-none focus:ring-0 focus-visible:ring-0 focus:outline-none resize-none shadow-none"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={
                        ["streaming", "submitted"].includes(status) ||
                        !form.getValues().model
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
                          Stop
                        </Button>
                      ) : (
                        <Button type="submit" disabled={status === "submitted"}>
                          Send
                        </Button>
                      )}
                    </div>
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
