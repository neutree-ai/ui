import { useCustom } from "@refinedev/core";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { playgroundMaxLength } from "@/domains/endpoint/lib/chat-helpers";
import type { Endpoint } from "@/domains/endpoint/types";

type ModelOption = { label: string; value: string };

/** An entry of `/v1/models`. `max_model_len` is vLLM's; other servers may
 * leave it out. */
type ServedModel = { id: string; max_model_len?: unknown };

export function usePlaygroundModels(
  endpoint: Endpoint,
  form: UseFormReturn<any>,
) {
  const modelsData = useCustom({
    url: `/serve-proxy/${endpoint.metadata.workspace}/${endpoint.metadata.name}/v1/models`,
    method: "get",
    queryOptions: {
      enabled: Boolean(endpoint?.metadata?.name),
    },
  });

  const served: ServedModel[] | undefined = modelsData.data?.data?.data;
  const modelList = served ?? [];
  const models: ModelOption[] = modelList.map((v) => ({
    label: v.id,
    value: v.id,
  }));

  const selectedModel = form.watch("model");

  useEffect(() => {
    if (served?.length && !selectedModel) {
      form.setValue("model", served[0].id);
    }
  }, [served, form.setValue, selectedModel]);

  // The fixed default asks for as many output tokens as many models have
  // context, which vLLM refuses outright: the prompt then has no room at all.
  // Where the server says how long the context is, start from half of it. A
  // value the user has set is theirs and stays: it is only replaced while it
  // still holds the last default put there.
  const maxModelLen = modelList.find(
    (v) => v.id === selectedModel,
  )?.max_model_len;
  const lastDefault = useRef<number | undefined>(undefined);

  useEffect(() => {
    const maxLength = playgroundMaxLength(maxModelLen);
    if (maxLength === null) return;

    lastDefault.current ??= form.formState.defaultValues?.max_length;
    if (form.getValues("max_length") !== lastDefault.current) return;

    lastDefault.current = maxLength;
    form.setValue("max_length", maxLength);
  }, [maxModelLen, form]);

  return {
    models,
    isLoading: modelsData.isFetching,
  };
}
