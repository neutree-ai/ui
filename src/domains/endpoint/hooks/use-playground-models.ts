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

  // A fixed default can ask for as many output tokens as the model has
  // context, which vLLM refuses outright: the prompt then has no room at all.
  // So the default comes from the selected model where the server says how
  // long its context is, and is the form's own default where it does not.
  // Once the user has set a value it is theirs: no later default replaces it.
  const maxModelLen = modelList.find(
    (v) => v.id === selectedModel,
  )?.max_model_len;
  const userSetMaxLength = useRef(false);

  useEffect(() => {
    if (!selectedModel || userSetMaxLength.current) return;

    const maxLength =
      playgroundMaxLength(maxModelLen) ??
      form.formState.defaultValues?.max_length;
    if (maxLength !== undefined) {
      form.setValue("max_length", maxLength);
    }
  }, [selectedModel, maxModelLen, form]);

  /** Records that the user chose the value, so it is never defaulted again. */
  const setMaxLength = (value: number) => {
    userSetMaxLength.current = true;
    form.setValue("max_length", value, { shouldDirty: true });
  };

  return {
    models,
    isLoading: modelsData.isFetching,
    setMaxLength,
  };
}
