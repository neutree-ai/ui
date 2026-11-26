import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import {
  fixtureMetadata,
  VISUAL_WORKSPACE,
} from "@/foundation/testing/visual-fixtures";
import { makeExternalEndpoint, makeTarget, makeUpstream } from "./fixtures";

/**
 * A degraded gateway over an internal endpoint, an external provider and an
 * unnamed failed provider, with one route of each strategy.
 */
export const routedExternalEndpoint: ExternalEndpoint = {
  ...makeExternalEndpoint({
    upstreams: [
      makeUpstream({
        name: "local",
        upstream: null,
        endpoint_ref: "endpoint-a",
        model_mapping: { chat: "qwen", embed: "bge" },
      }),
      makeUpstream({
        name: "cloud",
        upstream: { url: "https://api.example.com/v1" },
        auth: { type: "bearer", credential: "sk-example" },
        model_mapping: { chat: "gpt-x", fast: "gpt-mini" },
      }),
      makeUpstream({
        name: "",
        upstream: { url: "https://backup.example.com/v1" },
        model_mapping: { backup: "llama" },
      }),
    ],
    model_sources: { chat: "local" },
    model_routes: [
      {
        model: "chat",
        strategy: "weighted",
        targets: [
          makeTarget({
            upstream: "local",
            upstream_model: "qwen",
            weight: 100,
          }),
          makeTarget({
            upstream: "cloud",
            upstream_model: "gpt-x",
            weight: 0,
            max_inflight_requests: 8,
          }),
        ],
      },
      {
        model: "fast",
        strategy: "priority",
        targets: [
          makeTarget({
            upstream: "cloud",
            upstream_model: "gpt-mini",
            max_inflight_requests: 4,
          }),
          makeTarget({
            upstream: "local",
            upstream_model: "qwen",
            priority: 1,
          }),
        ],
      },
      {
        model: "embed",
        targets: [makeTarget({ upstream: "local", upstream_model: "bge" })],
      },
    ],
  }),
  metadata: fixtureMetadata("gateway-a", { workspace: VISUAL_WORKSPACE }),
  status: {
    phase: "Degraded",
    last_transition_time: "2026-05-30T10:00:00Z",
    error_message: null,
    service_url: "http://gateway.example.com",
    upstream_status: [
      {
        kind: "endpoint_ref",
        ref: "endpoint-a",
        models: ["qwen", "bge"],
        phase: "Ready",
      },
      {
        kind: "external",
        ref: "https://api.example.com/v1",
        models: ["gpt-x", "gpt-mini"],
        phase: "Ready",
      },
      {
        kind: "external",
        ref: "https://backup.example.com/v1",
        models: null,
        phase: "Failed",
        error_message: "connection refused",
      },
    ],
  } as unknown as ExternalEndpoint["status"],
};

/** A gateway saved before routes existed: models come only from the upstream mappings. */
export const legacyExternalEndpoint: ExternalEndpoint = {
  ...makeExternalEndpoint({
    model_routes: null,
    upstreams: [makeUpstream({ name: "", model_mapping: { chat: "gpt-x" } })],
  }),
  metadata: fixtureMetadata("gateway-legacy", { workspace: VISUAL_WORKSPACE }),
};
