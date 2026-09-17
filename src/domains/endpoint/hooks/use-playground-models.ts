import { useCustom } from "@refinedev/core";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Endpoint } from "@/domains/endpoint/types";

type ModelOption = { label: string; value: string };

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

  // The engine serves the model as `name:version`, and that id is what a
  // request has to send, so only the label drops the version — see
  // EndpointModel.
  const model = endpoint.spec?.model;
  const labels: Record<string, string> = model?.version
    ? { [`${model.name}:${model.version}`]: model.name }
    : {};

  const models: ModelOption[] = (modelsData.data?.data?.data || []).map(
    (v: { id: string }) => ({
      label: labels[v.id] ?? v.id,
      value: v.id,
    }),
  );

  const selectedModel = form.watch("model");

  useEffect(() => {
    const modelList = modelsData.data?.data?.data || [];
    if (modelList.length > 0 && !selectedModel) {
      form.setValue("model", modelList[0].id);
    }
  }, [modelsData.data, form.setValue, selectedModel]);

  return {
    models,
    isLoading: modelsData.isFetching,
  };
}
