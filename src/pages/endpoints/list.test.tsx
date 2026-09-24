import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointsList } from "@/pages/endpoints/list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/foundation/components/metadata-columns", () => ({
  useMetadataColumns: () => ({
    name: null,
    workspace: null,
    creation_timestamp: null,
    action: null,
  }),
}));

// The list's machinery — refine, the table, the other columns — is not what
// this file is about, so it is stubbed down to the one thing the page itself
// decides: what a row of `endpoints` puts in the Model cell. The stub keeps the
// real contract (`Table.Column` receives `cell`, and the table calls it with
// `{ row: { original } }`), so the column definition under test is the page's.
const state = vi.hoisted(() => ({ row: null as unknown }));

vi.mock("@/foundation/components/Table", () => {
  const Table = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  Table.Column = ({
    id,
    cell,
  }: {
    id?: string;
    cell?: (context: {
      row: { original: unknown };
      getValue: () => unknown;
    }) => ReactNode;
  }) => (
    <div data-testid={`cell-${id}`}>
      {cell
        ? cell({ row: { original: state.row }, getValue: () => null })
        : null}
    </div>
  );
  return { Table, defaultSorters: { initial: [] } };
});

vi.mock("@/foundation/components/EndpointStatus", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/ModelTask", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointEngine", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointPauseAction", () => ({
  EndpointPauseAction: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointSaveAsCatalogAction", () => ({
  EndpointSaveAsCatalogAction: () => null,
  EndpointSaveAsCatalogProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/domains/endpoint/components/ModelTaskFilter", () => ({
  ModelTaskFilter: () => null,
}));
vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const endpoint = (model: unknown) => ({
  id: 1,
  api_version: "v1",
  kind: "Endpoint",
  metadata: { name: "an-endpoint", workspace: "design-lab" },
  spec: {
    cluster: "a-cluster",
    model,
    engine: { engine: "vllm", version: "v0.8.5" },
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: null,
    env: null,
  },
  status: null,
});

const modelCell = () => within(screen.getByTestId("cell-model"));

describe("EndpointsList model column", () => {
  beforeEach(() => {
    state.row = null;
  });

  // The create form submits an engine that brings its own workload with
  // `spec.model` still set — it carries the task the gateway routes on and no
  // name at all. The cell used to render that as an empty string.
  it("shows a placeholder, and no source label, for an engine that has no model", () => {
    state.row = endpoint({
      registry: "",
      name: "",
      file: "",
      version: "",
      task: "text-generation",
    });

    render(<EndpointsList />);

    expect(modelCell().getByText("-")).toBeTruthy();
    expect(modelCell().queryByText("self-hosted")).toBeNull();
  });

  it("keeps the model and its source label together", () => {
    state.row = endpoint({
      registry: "huggingface",
      name: "Qwen/Qwen3-8B",
      file: "model.safetensors",
      version: "3.0",
      task: "text-generation",
    });

    render(<EndpointsList />);

    expect(modelCell().getByText("Qwen/Qwen3-8B:3.0")).toBeTruthy();
    expect(modelCell().getByText("self-hosted")).toBeTruthy();
  });
});
