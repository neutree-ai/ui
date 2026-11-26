import type { Endpoint } from "@/domains/endpoint/types";
import {
  fixtureMetadata,
  VISUAL_WORKSPACE,
} from "@/foundation/testing/visual-fixtures";
import { makeEndpoint } from "./builders";

const running = (endpoint: Endpoint, name: string): Endpoint => ({
  ...endpoint,
  metadata: fixtureMetadata(name, { workspace: VISUAL_WORKSPACE }),
  status: {
    phase: "Running",
    last_transition_time: "2026-05-30T10:00:00Z",
    service_url: null,
    error_message: null,
  } as unknown as Endpoint["status"],
});

/** A running vLLM 0.31.0 endpoint on cluster-a. */
export const chatEndpoint = running(makeEndpoint(), "endpoint-a");

/** A running endpoint whose engine names no version. */
export const unversionedEngineEndpoint = running(
  makeEndpoint({ spec: { engine: { engine: "vllm", version: "" } } }),
  "endpoint-b",
);

/** What the edit wizard reads besides the endpoint: its cluster, engine and registry. */
export const endpointFormTables = {
  engines: [
    {
      id: 1,
      api_version: "v1",
      kind: "Engine",
      metadata: fixtureMetadata("vllm", { workspace: VISUAL_WORKSPACE }),
      spec: {
        versions: [{ version: "0.31.0", supported_tasks: ["text-generation"] }],
        supported_tasks: ["text-generation"],
      },
      status: { phase: "Created" },
    },
  ],
  model_registries: [
    {
      id: 1,
      api_version: "v1",
      kind: "ModelRegistry",
      metadata: fixtureMetadata("hf", { workspace: VISUAL_WORKSPACE }),
      spec: { type: "hugging-face", url: "https://huggingface.co" },
      status: { phase: "Connected" },
    },
  ],
  model_catalogs: [],
};

/** Registry model lookups the edit wizard makes for `hf/qwen`. */
export const endpointFormCustom = {
  "workspaces/default/model_registries/hf/models": [],
  "workspaces/default/model_registries/hf/models/qwen": {
    name: "qwen",
    versions: [],
  },
};
