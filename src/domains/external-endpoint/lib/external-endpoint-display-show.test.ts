import { describe, expect, it } from "vitest";
import { makeExternalEndpoint, makeUpstream } from "../testing/fixtures";
import type { ExternalEndpoint } from "../types";
import { externalEndpointShowView } from "./external-endpoint-display-show";

const withStatus = (
  record: ExternalEndpoint,
  status: Partial<NonNullable<ExternalEndpoint["status"]>>,
): ExternalEndpoint => ({
  ...record,
  status: { phase: "Running", service_url: null, ...status },
});

describe("externalEndpointShowView", () => {
  it.each([
    { phase: "Running", url: "https://gw/ee", example: "https://gw/ee" },
    { phase: "Degraded", url: "https://gw/ee", example: "https://gw/ee" },
    { phase: "Failed", url: "https://gw/ee", example: undefined },
    { phase: "Running", url: null, example: undefined },
  ] as const)(
    "$phase with url $url -> example $example",
    ({ phase, url, example }) => {
      const view = externalEndpointShowView(
        withStatus(makeExternalEndpoint(), { phase, service_url: url }),
      );
      expect(view.exampleServiceUrl).toBe(example);
      expect(view.serviceUrl).toBe(url ?? undefined);
    },
  );

  it("names, classifies and references each upstream", () => {
    const view = externalEndpointShowView(
      makeExternalEndpoint({
        upstreams: [
          makeUpstream({ name: "" }),
          makeUpstream({
            name: "local",
            endpoint_ref: "llama",
            upstream: null,
          }),
          makeUpstream({ name: "blank", upstream: { url: "" } }),
        ],
      }),
    );
    expect(
      view.upstreams.map(({ name, internal, reference }) => ({
        name,
        internal,
        reference,
      })),
    ).toEqual([
      { name: "provider-1", internal: false, reference: "https://example.com" },
      { name: "local", internal: true, reference: "llama" },
      { name: "blank", internal: false, reference: undefined },
    ]);
  });

  it("monitors only stored routes and drops the models a failed upstream serves", () => {
    const record = withStatus(
      makeExternalEndpoint({
        upstreams: [
          makeUpstream({ model_mapping: { chat: "gpt" } }),
          makeUpstream({ name: "b", model_mapping: { embed: "e" } }),
        ],
        model_routes: null,
      }),
      {
        upstream_status: [
          { ref: "https://example.com", phase: "Ready", models: ["chat"] },
          { ref: "https://example.com", phase: "Failed", models: ["embed"] },
        ],
      },
    );
    const view = externalEndpointShowView(record);
    expect(view.monitorsRoutes).toBe(false);
    expect(view.routes.map((route) => route.model)).toEqual(["chat", "embed"]);
    expect(view.callableModels).toEqual(["chat"]);
    expect(view.upstreams.map((card) => card.failedStatus?.phase)).toEqual([
      undefined,
      "Failed",
    ]);
  });
});
