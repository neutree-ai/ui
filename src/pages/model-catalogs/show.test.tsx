import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelCatalog } from "@/domains/model-catalog/types";

const { advancedParameters, useShowMock } = vi.hoisted(() => ({
  advancedParameters: {
    current: null as {
      engineParameters: Record<string, unknown>;
      environmentVariables: Record<string, unknown> | null;
    } | null,
  },
  useShowMock: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({ useShow: useShowMock }));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  );
  ShowPage.ObjectHeader = ({
    title,
    description,
  }: {
    title: ReactNode;
    description?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <div>{description}</div>
    </header>
  );
  ShowPage.Meta = ({ children }: { children: ReactNode }) => <>{children}</>;
  ShowPage.Row = ({ children }: { children: ReactNode }) => <>{children}</>;
  ShowPage.Section = ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  );
  return { ShowPage };
});

vi.mock("@/domains/endpoint/components/EndpointAdvancedParameters", () => ({
  EndpointAdvancedParameters: (props: {
    engineParameters: Record<string, unknown>;
    environmentVariables: Record<string, unknown> | null;
  }) => {
    advancedParameters.current = props;
    return <div data-testid="advanced-parameters" />;
  },
}));

vi.mock("@/domains/endpoint/components/DeploymentConfigCard", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointEngine", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointModel", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/ModelTask", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/ResourcesCard", () => ({
  default: () => null,
}));
vi.mock("@/domains/model-catalog/components/ModelCatalogStatus", () => ({
  default: () => null,
}));
vi.mock("@/foundation/components/EmptyValue", () => ({
  EmptyValue: () => null,
}));
vi.mock("@/foundation/components/MetadataTimestampMeta", () => ({
  MetadataTimestampMeta: () => null,
}));
vi.mock("@/pages/model-catalogs/components/FeaturesList", () => ({
  FeaturesList: () => null,
}));
vi.mock("@/pages/model-catalogs/components/KeyConfigCard", () => ({
  EnvCard: () => null,
  KeyConfigCard: () => null,
}));
vi.mock("@/pages/model-catalogs/components/VariantTable", () => ({
  VariantTable: () => null,
}));

import { ModelCatalogsShow } from "./show";

const catalog = {
  id: 1,
  api_version: "v1",
  kind: "ModelCatalog",
  metadata: {
    name: "catalog-a",
    workspace: "workspace-a",
    creation_timestamp: "2026-08-28T00:00:00Z",
    annotations: {},
  },
  spec: {
    model: null,
    engine: { engine: "vllm", version: "v1.0.0" },
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: {
      engine_args: {
        tensor_parallel_size: 1,
      },
    },
    env: null,
    base: {
      engine_args: {
        reasoning_parser: "qwen3",
      },
    },
    variants: {
      default: {
        engine_args: { kv_cache_dtype: "fp8" },
      },
      long: {
        engine_args: { max_model_len: 131072 },
      },
    },
    features: [
      {
        name: "tool-choice",
        engine_args: { enable_auto_tool_choice: true },
      },
    ],
  },
  status: { phase: "Ready" },
} as unknown as ModelCatalog;

describe("ModelCatalogsShow", () => {
  beforeEach(() => {
    advancedParameters.current = null;
    useShowMock.mockReset();
    useShowMock.mockReturnValue({
      query: { data: { data: catalog }, isLoading: false },
    });
  });

  it("passes all recipe engine arguments to the shared advanced table", () => {
    render(<ModelCatalogsShow />);

    expect(screen.getByTestId("advanced-parameters")).toBeTruthy();
    expect(advancedParameters.current).toEqual({
      engineParameters: {
        reasoning_parser: "qwen3",
        tensor_parallel_size: 1,
        kv_cache_dtype: "fp8",
        max_model_len: 131072,
        enable_auto_tool_choice: true,
      },
      environmentVariables: null,
    });
  });
});
