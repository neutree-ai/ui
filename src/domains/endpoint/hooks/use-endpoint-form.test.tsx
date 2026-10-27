import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@refinedev/core", () => ({
  useSelect: vi.fn(),
  useCustom: () => ({
    data: { data: { capabilities: { cluster_cache_providers: [] } } },
  }),
}));

// The model dropdown and the exact-name existence lookup both list registry
// models; picking a model reads that version's detail.
vi.mock("@/foundation/hooks/use-registry-models", () => ({
  useRegistryModels: vi.fn(),
}));
vi.mock("@/foundation/hooks/use-registry-model-version", () => ({
  useRegistryModelVersion: vi.fn(),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: vi.fn(),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

vi.mock("@/foundation/components/VariablesInput", () => ({
  VariablesInput: React.forwardRef(
    (_props: unknown, ref: React.Ref<HTMLDivElement>) => (
      <div data-testid="variables-input-mock" ref={ref} />
    ),
  ),
}));

import { useSelect } from "@refinedev/core";
import { defaultEndpointSpec } from "@/domains/endpoint/lib/endpoint-form-helpers";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { selectOption } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import {
  FULL_T4,
  makeGpuDevice,
  makeNodeResources,
  makeResourceInfo,
  vgpuProduct,
} from "@/foundation/testing/resource-builders";
import type {
  ClusterResourceInfo,
  DeviceResource,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";
import { useEndpointForm } from "./use-endpoint-form";

// --- Fixture builders ---

const T4 = "Tesla-T4";
const L20 = "NVIDIA-L20";

const metadata = (name: string) => ({
  name,
  workspace: "default",
  deletion_timestamp: null,
  creation_timestamp: "",
  update_timestamp: "",
  labels: {},
  annotations: {},
});

function makeCluster(
  name: string,
  {
    type = "kubernetes",
    vgpuEnabled = false,
    supportedResources,
    readyNodes,
    cacheNodes,
    resources,
  }: {
    type?: string;
    vgpuEnabled?: boolean;
    supportedResources?: string[];
    readyNodes?: number;
    cacheNodes?: string[];
    resources?: Partial<ClusterResourceInfo> & {
      nodes?: Record<string, NodeResourceStatus> | null;
    };
  } = {},
): EndpointClusterRef {
  const { nodes = null, ...info } = resources ?? {};
  return {
    metadata: metadata(name),
    spec: {
      type,
      ...(vgpuEnabled && { accelerator_virtualization: { enabled: true } }),
      ...(cacheNodes && {
        cache: {
          provider: "zcache",
          options: { enabled: true, target_nodes: cacheNodes },
        },
      }),
    },
    status: {
      ready_nodes: readyNodes,
      resource_info: resources
        ? {
            allocatable: null,
            available: null,
            ...info,
            node_resources: nodes,
          }
        : null,
      ...(supportedResources && {
        accelerator_virtualization: { supported_resources: supportedResources },
      }),
    },
  };
}

const noResourceCluster = makeCluster("no-resources");

/**
 * Two T4 nodes. node-a has a free card, node-b's card is fully allocated
 * unless `allFree`. `cpu` and `memory` are free amounts for [cluster, node-a,
 * node-b].
 */
function plainGpuCluster({
  name = "plain-gpu",
  type = "kubernetes",
  allFree = false,
  cpu = [20, 10, 10],
  memory = [96, 48, 48],
  cacheNodes,
  extraProducts = {},
}: {
  name?: string;
  type?: string;
  allFree?: boolean;
  cpu?: number[];
  memory?: number[];
  cacheNodes?: string[];
  extraProducts?: Record<string, number>;
} = {}) {
  const node = (index: number, card: DeviceResource) => ({
    allocatable: makeResourceInfo(16, 64, { [T4]: 2 }),
    available: makeResourceInfo(cpu[index], memory[index], { [T4]: 1 }),
    devices: [card],
  });
  return makeCluster(name, {
    type,
    cacheNodes,
    resources: {
      allocatable: makeResourceInfo(32, 128, { [T4]: 4, ...extraProducts }),
      available: makeResourceInfo(cpu[0], memory[0], {
        [T4]: 2,
        ...extraProducts,
      }),
      nodes: {
        "node-a": node(1, makeGpuDevice("GPU-free")),
        "node-b": node(
          2,
          makeGpuDevice(
            "GPU-used",
            allFree ? FULL_T4 : { memory_mib: 0, core_units: 0 },
          ),
        ),
      },
    },
  });
}

/** Two vGPU-enabled T4 nodes, each with one half-used card. */
function vgpuCluster({
  name = "vgpu",
  supportedResources,
  free = [
    { memory_mib: 7680, core_units: 50 },
    { memory_mib: 7680, core_units: 100 },
  ],
}: {
  name?: string;
  supportedResources?: string[];
  free?: { memory_mib: number; core_units: number }[];
} = {}) {
  return makeCluster(name, {
    vgpuEnabled: true,
    supportedResources,
    resources: {
      allocatable: makeResourceInfo(16, 64, {
        [T4]: vgpuProduct(2, 30720, 200),
      }),
      available: makeResourceInfo(12, 48, { [T4]: vgpuProduct(1, 15360, 150) }),
      nodes: {
        "node-a": {
          allocatable: makeResourceInfo(16, 64, {
            [T4]: vgpuProduct(2, 30720, 200),
          }),
          available: makeResourceInfo(12, 48, {
            [T4]: vgpuProduct(1, 15360, 150),
          }),
          devices: [makeGpuDevice("GPU-a", free[0])],
        },
        "node-b": {
          allocatable: makeResourceInfo(16, 64, { [T4]: { quantity: 1 } }),
          available: makeResourceInfo(12, 48, { [T4]: { quantity: 0 } }),
          devices: [makeGpuDevice("GPU-b", free[1])],
        },
      },
    },
  });
}

/** vGPU aggregates with no node topology. */
const vgpuAggregateCluster = makeCluster("vgpu-aggregate", {
  vgpuEnabled: true,
  readyNodes: 2,
  resources: {
    allocatable: makeResourceInfo(16, 64, { [T4]: vgpuProduct(2, 30720, 200) }),
    available: makeResourceInfo(12, 48, { [T4]: vgpuProduct(1, 15360, 150) }),
  },
});

/**
 * One fully usable card plus two whose 2 GiB residual cannot hold a 4 GiB
 * vGPU card: card capacity is 1 while summed memory and core stay ample.
 */
const oneUsableCardCluster = makeCluster("one-usable-card", {
  vgpuEnabled: true,
  resources: {
    allocatable: makeResourceInfo(16, 64, { [T4]: { quantity: 3 } }),
    available: makeResourceInfo(12, 48, { [T4]: { quantity: 1 } }),
    nodes: {
      "node-a": makeNodeResources({
        devices: [
          makeGpuDevice("GPU-a", { memory_mib: 7680, core_units: 100 }),
          ...["GPU-b", "GPU-c"].map((uuid) =>
            makeGpuDevice(
              uuid,
              { memory_mib: 2048, core_units: 100 },
              { allocatable: { memory_mib: 8192, core_units: 100 } },
            ),
          ),
        ],
      }),
    },
  },
});

/** Two 45 GiB L20 cards with 1012 MiB and 7156 MiB left. */
const fragmentedL20Cluster = (() => {
  const allocatable = makeResourceInfo(64, 256, {
    [L20]: vgpuProduct(2, 92136, 200),
  });
  const available = makeResourceInfo(48, 192, {
    [L20]: vgpuProduct(2, 8168, 45),
  });
  const card = (uuid: string, memory_mib: number, core_units: number) =>
    makeGpuDevice(
      uuid,
      { memory_mib, core_units },
      { product: L20, allocatable: { memory_mib: 46068, core_units: 100 } },
    );
  return makeCluster("fragmented-l20", {
    vgpuEnabled: true,
    resources: {
      allocatable,
      available,
      accelerator_metadata: {
        nvidia_gpu: { products: { [L20]: { memory_total_mib: 46068 } } },
      },
      nodes: {
        "node-l20": {
          allocatable,
          available,
          devices: [card("GPU-l20-a", 1012, 30), card("GPU-l20-b", 7156, 15)],
        },
      },
    },
  });
})();

/** Two T4 cards with 60 of 100 core units free each. */
const fractionalSlotsCluster = makeCluster("fractional-slots", {
  resources: {
    allocatable: makeResourceInfo(16, 64, { [T4]: { quantity: 2 } }),
    available: makeResourceInfo(12, 48, { [T4]: { quantity: 2 } }),
    nodes: {
      "node-a": makeNodeResources({
        devices: ["GPU-a", "GPU-b"].map((uuid) =>
          makeGpuDevice(uuid, { memory_mib: 9216, core_units: 60 }),
        ),
      }),
    },
  },
});

/** Form-shaped resources for one replica. */
const formResources = ({
  cpu = 2,
  memory = 8,
  gpu = 1,
  product = T4,
  virtualization,
}: {
  cpu?: number;
  memory?: number;
  gpu?: number;
  product?: string;
  virtualization?: Record<string, number>;
} = {}) => ({
  cpu,
  memory,
  gpu,
  accelerator: {
    type: "nvidia_gpu",
    product,
    ...(virtualization && { virtualization }),
  },
});

/** Backend-shaped resources: string quantities and flat vGPU keys. */
const backendResources = ({
  cpu = 2,
  memory = 8,
  gpu = 1,
  product = T4,
  virtualization,
}: {
  cpu?: number;
  memory?: number | string;
  gpu?: number;
  product?: string;
  virtualization?: { memory_mib: number; core_percent: number };
} = {}) => ({
  cpu: String(cpu),
  memory: String(memory),
  gpu: String(gpu),
  accelerator: {
    type: "nvidia_gpu",
    product,
    ...(virtualization && {
      "virtualization.memory_mib": String(virtualization.memory_mib),
      "virtualization.core_percent": String(virtualization.core_percent),
    }),
  },
});

const allocation = (
  node: string,
  uuid?: string,
  memory_mib = 0,
  core_units = 0,
) => ({
  instance_id: `${node}-${uuid ?? "cpu"}`,
  node_id: node,
  devices: uuid
    ? [{ uuid, product: T4, memory_mib, core_units, node_id: node }]
    : [],
});

const catalogA = {
  id: 1,
  metadata: { name: "vllm-llama" },
  spec: {
    model: {
      name: "llama-3",
      version: "1.0",
      registry: "hf",
      file: "model.bin",
      task: "text-generation",
    },
    engine: { engine: "vllm", version: "0.6.0" },
    resources: { cpu: "4", memory: "8", gpu: "1", accelerator: null },
    replicas: { num: 2 },
    deployment_options: { scheduler: { type: "roundrobin" } },
    variables: { engine_args: { tensor_parallel: "1" } },
    env: {},
  },
};

const catalogB = {
  id: 2,
  metadata: { name: "llama-cpp-basic" },
  spec: {
    model: {
      name: "tiny-model",
      version: "2.0",
      registry: "local",
      file: "",
      task: "embedding",
    },
    engine: { engine: "llama-cpp", version: "1.0.0" },
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: null,
    env: null,
  },
};

/** A recipe-shaped catalog (it has variants), which turns on simplified mode. */
function recipeCatalog({
  id = 3,
  name = "recipe-mc",
  annotations,
  model = {},
  variant = {},
  features,
}: {
  id?: number;
  name?: string;
  annotations?: Record<string, string>;
  model?: Record<string, unknown>;
  variant?: Record<string, unknown>;
  features?: unknown[];
} = {}) {
  return {
    id,
    metadata: { name, ...(annotations && { annotations }) },
    spec: {
      engine: { engine: "vllm", version: "0.8.5" },
      variants: {
        default: {
          ...variant,
          model: {
            name: "org/recipe-model",
            version: "",
            registry: "hf",
            file: "",
            task: "text-generation",
            ...model,
          },
        },
      },
      ...(features && { features }),
    },
  };
}

const engineRef = (name: string) => ({
  metadata: metadata(name),
  spec: {
    versions: [{ version: "v1", values_schema: {} }],
    supported_tasks: ["text-generation"],
  },
});

const registryModelsResult = (models: unknown[] = [], page: unknown = null) =>
  ({
    page,
    models,
    total: page ? models.length : null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }) as unknown as ReturnType<typeof useRegistryModels>;

const modelVersionResult = (model: unknown = null, isLoading = false) =>
  ({
    model,
    isLoading,
    isFetching: isLoading,
    error: null,
    refetch: vi.fn(),
  }) as unknown as ReturnType<typeof useRegistryModelVersion>;

// --- Harness ---

type Lists = {
  catalogs?: unknown[];
  clusters?: EndpointClusterRef[];
  registries?: unknown[];
  engines?: unknown[];
};

function mockLists({
  catalogs = [catalogA, catalogB],
  clusters = [],
  registries = [],
  engines = [],
}: Lists = {}) {
  const lists: Record<string, unknown[]> = {
    model_catalogs: catalogs,
    clusters,
    model_registries: registries,
    engines,
  };
  vi.mocked(useSelect).mockImplementation(((opts: { resource: string }) => ({
    query: { data: { data: lists[opts.resource] ?? [] }, isLoading: false },
  })) as unknown as typeof useSelect);
}

function renderEndpointForm(
  action: "create" | "edit" = "create",
  lists?: Lists,
) {
  if (lists) mockLists(lists);
  return renderForm(
    () => useEndpointForm({ action }),
    (r) => (
      <>
        {r.metadataFields}
        {r.advancedToggle}
        {r.templateFields}
        {r.recipeFields}
        {r.weightFields}
        {r.resourceFields}
        {r.customizeFields}
      </>
    ),
  );
}

type Rendered = ReturnType<typeof renderEndpointForm>["result"];

function setValues(result: Rendered, values: Record<string, unknown>) {
  act(() => {
    for (const [name, value] of Object.entries(values)) {
      result.current.form.setValue(name as never, value as never);
    }
  });
}

const fieldValue = (result: Rendered, name: string) =>
  result.current.form.getValues(name as never);

async function submit(result: Rendered) {
  await act(async () => {
    await result.current.form.refineCore.onFinish(
      result.current.form.getValues(),
    );
  });
  return refineForm.onFinish.mock.calls[0]?.[0];
}

async function validate(result: Rendered, name?: string) {
  await act(async () => {
    await result.current.form.trigger(name as never);
  });
}

function openCombobox(fieldName: string) {
  const trigger = screen
    .getByTestId(`field-${fieldName}`)
    .querySelector('button[role="combobox"]');
  if (!trigger) throw new Error(`no combobox in field-${fieldName}`);
  fireEvent.click(trigger);
  return trigger as HTMLButtonElement;
}

const selectCatalog = (label: string) => selectOption("-model-catalog", label);

const memoryInput = () =>
  screen.getByRole("spinbutton", {
    name: /endpoints.fields.singleCardMemory/i,
  }) as HTMLInputElement;

const coreInput = () =>
  screen.getByRole("spinbutton", {
    name: /endpoints.fields.vgpuCoreLimit/i,
  }) as HTMLInputElement;

function typeInto(input: HTMLInputElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}

const currentRequest = () =>
  screen.getByTestId("endpoint-current-request-grid").textContent;

const VIRTUALIZATION = "spec.resources.accelerator.virtualization";

beforeEach(() => {
  mockLists();
  vi.mocked(useWorkspace).mockReturnValue({ current: "default" } as never);
  vi.mocked(useRegistryModels).mockReturnValue(registryModelsResult());
  vi.mocked(useRegistryModelVersion).mockReturnValue(modelVersionResult());
});

// --- Tests ---

describe("create vs edit", () => {
  it.each([
    { action: "create" as const, locked: false },
    { action: "edit" as const, locked: true },
  ])(
    "$action: catalog picker hidden and name and cluster locked: $locked",
    async ({ action, locked }) => {
      renderEndpointForm(action, { clusters: [vgpuCluster()] });

      expect(screen.queryByTestId("field--model-catalog") === null).toBe(
        locked,
      );
      expect(
        screen.getByTestId("field-metadata.name").querySelector("input")
          ?.disabled,
      ).toBe(locked);
      const cluster = await within(
        screen.getByTestId("field-spec.cluster"),
      ).findByRole("combobox");
      expect(cluster.hasAttribute("disabled")).toBe(locked);
    },
  );

  it("keeps an edited endpoint's cluster selectable when it is not listed", async () => {
    const { result } = renderEndpointForm("edit", {
      clusters: [vgpuCluster()],
    });

    setValues(result, { "spec.cluster": "unlisted-cluster" });

    const cluster = await within(
      screen.getByTestId("field-spec.cluster"),
    ).findByRole("combobox");
    expect(cluster.textContent).toContain("unlisted-cluster");
  });
});

describe("loading an existing endpoint", () => {
  const storedVgpu = { memory_mib: 8192, core_percent: 50 };

  it("normalizes the backend record for the form", () => {
    renderEndpointForm("edit");

    const { select } = (
      refineForm.options as {
        refineCoreProps: {
          queryOptions: {
            select: (response: { data: unknown }) => {
              data: { spec: { resources: unknown } };
            };
          };
        };
      }
    ).refineCoreProps.queryOptions;
    const selected = select({
      data: {
        metadata: metadata("endpoint"),
        spec: {
          resources: backendResources({
            memory: "8Gi",
            virtualization: storedVgpu,
          }),
        },
      },
    });

    expect(selected.data.spec.resources).toEqual(
      formResources({ virtualization: storedVgpu }),
    );
  });

  it("syncs the loaded resources into the form", async () => {
    refineForm.queryData = {
      spec: {
        resources: backendResources({
          memory: "8Gi",
          virtualization: storedVgpu,
        }),
      },
    };
    const { result } = renderEndpointForm("edit");

    await waitFor(() =>
      expect(fieldValue(result, "spec.resources")).toEqual(
        formResources({ virtualization: storedVgpu }),
      ),
    );
  });

  it("does not overwrite resources the user edited with the loaded ones", async () => {
    refineForm.queryData = {
      spec: { resources: backendResources({ virtualization: storedVgpu }) },
    };
    const { result } = renderEndpointForm("edit", {
      clusters: [vgpuCluster()],
    });
    await waitFor(() =>
      expect(fieldValue(result, `${VIRTUALIZATION}.memory_mib`)).toBe(8192),
    );
    setValues(result, { "spec.cluster": "vgpu" });

    typeInto(memoryInput(), "4");

    expect(fieldValue(result, `${VIRTUALIZATION}.memory_mib`)).toBe(4096);
  });
});

describe("vGPU split inputs", () => {
  it("edits the core limit and the single-card memory (GiB in, MiB stored) independently", () => {
    const { result } = renderEndpointForm("create", {
      clusters: [vgpuCluster()],
    });
    setValues(result, {
      "spec.cluster": "vgpu",
      "spec.resources.accelerator": { type: "nvidia_gpu", product: T4 },
    });

    typeInto(coreInput(), "25");
    expect(fieldValue(result, VIRTUALIZATION)).toEqual({ core_percent: 25 });

    typeInto(memoryInput(), "4");
    expect(fieldValue(result, VIRTUALIZATION)).toEqual({
      core_percent: 25,
      memory_mib: 4096,
    });
  });

  it("keeps the core limit when the memory is cleared or zeroed", () => {
    const { result } = renderEndpointForm("create", {
      clusters: [vgpuCluster()],
    });
    setValues(result, {
      "spec.cluster": "vgpu",
      "spec.resources.accelerator": formResources({
        virtualization: { memory_mib: 4096, core_percent: 25 },
      }).accelerator,
    });

    typeInto(memoryInput(), "");
    expect(fieldValue(result, VIRTUALIZATION)).toEqual({ core_percent: 25 });

    typeInto(memoryInput(), "0");
    expect(fieldValue(result, VIRTUALIZATION)).toEqual({ core_percent: 25 });
  });

  it.each([
    {
      supported: undefined,
      coreDisabled: false,
      memoryDisabled: false,
      hint: "endpoints.messages.vgpuCoreLimitUnlimitedHint",
      kept: { memory_mib: 8192, core_percent: 50 },
    },
    {
      supported: ["virtualization.memory_mib"],
      coreDisabled: true,
      memoryDisabled: false,
      hint: "endpoints.messages.vgpuCoreLimitUnsupportedMode",
      kept: { memory_mib: 8192 },
    },
    {
      supported: [],
      coreDisabled: true,
      memoryDisabled: true,
      hint: null,
      kept: undefined,
    },
  ])(
    "supported resources $supported: disables core $coreDisabled, memory $memoryDisabled and keeps $kept",
    async ({ supported, coreDisabled, memoryDisabled, hint, kept }) => {
      const { result } = renderEndpointForm("create", {
        clusters: [vgpuCluster({ supportedResources: supported })],
      });
      setValues(result, {
        "spec.cluster": "vgpu",
        "spec.resources": formResources({
          virtualization: { memory_mib: 8192, core_percent: 50 },
        }),
      });

      expect(coreInput().disabled).toBe(coreDisabled);
      expect(memoryInput().disabled).toBe(memoryDisabled);
      if (hint) screen.getByText(hint);
      await waitFor(() =>
        expect(fieldValue(result, VIRTUALIZATION)).toEqual(kept),
      );
    },
  );

  it("drops the virtualization on a cluster without vGPU", async () => {
    const { result } = renderEndpointForm("create", {
      clusters: [noResourceCluster],
    });

    setValues(result, {
      "spec.cluster": "no-resources",
      "spec.resources.accelerator": formResources({
        virtualization: { memory_mib: 10240, core_percent: 30 },
      }).accelerator,
    });

    await waitFor(() =>
      expect(fieldValue(result, VIRTUALIZATION)).toBeUndefined(),
    );
  });

  it("bounds the memory by what each requested card can still place", async () => {
    const { result } = renderEndpointForm("create", {
      clusters: [fragmentedL20Cluster],
    });
    setValues(result, {
      "spec.cluster": "fragmented-l20",
      "spec.resources": formResources({ gpu: 0, product: L20 }),
    });
    // The roomier card has 7156 MiB left, shown as 7 GiB.
    expect(memoryInput().max).toBe("7");

    typeInto(memoryInput(), "1");
    expect(fieldValue(result, VIRTUALIZATION)).toEqual({ memory_mib: 1024 });

    // Two cards per replica must both fit: the smaller card leaves 1012 MiB.
    setValues(result, { "spec.resources.gpu": 2 });
    await waitFor(() =>
      expect(fieldValue(result, `${VIRTUALIZATION}.memory_mib`)).toBe(1012),
    );
    expect(memoryInput().value).toBe("1");
    expect(currentRequest()).toContain("2.0 / 2.0");
    expect(
      screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
    ).toBeNull();

    setValues(result, { "spec.replicas.num": 2 });
    await waitFor(() => expect(currentRequest()).toContain("4.0 / 2.0"));
    screen.getByText("endpoints.messages.vgpuResourcesInsufficient");
    expect(
      (
        screen.getByRole("spinbutton", {
          name: /endpoints.fields.vgpuCount/i,
        }) as HTMLInputElement
      ).max,
    ).toBe("2");
  });
});

describe("capacity checks", () => {
  // Every message that explains why a request cannot be placed.
  const PLACEMENT_MESSAGES = [
    "noMatchingAccelerator",
    "noNodeCanScheduleFullGpuRequest",
    "fullGpuCardCapacityInsufficient",
    "fullGpuResourcesInsufficient",
    "fractionalGpuResourcesInsufficient",
    "partialGpuReplicaPlacement",
    "vgpuResourcesInsufficient",
    "vgpuMemoryResourcesInsufficient",
    "vgpuCoreResourcesInsufficient",
    "noNodeCanScheduleVgpuRequest",
    "cpuResourcesInsufficient",
    "noNodeCanScheduleCpuRequest",
    "memoryResourcesInsufficient",
    "noNodeCanScheduleMemoryRequest",
    "noNodeCanScheduleCombinedResourceRequest",
  ];
  const shownMessages = () =>
    PLACEMENT_MESSAGES.filter(
      (key) =>
        screen.queryAllByText(new RegExp(`^endpoints\\.messages\\.${key}(:|$)`))
          .length > 0,
    );
  const quarterCard = { memory_mib: 4096, core_percent: 50 };

  it.each([
    {
      case: "a product the cluster lacks",
      cluster: plainGpuCluster(),
      resources: formResources({ product: L20 }),
      shown: ["noMatchingAccelerator"],
    },
    {
      case: "a vGPU product the cluster lacks",
      cluster: vgpuCluster(),
      resources: formResources({ product: L20, virtualization: quarterCard }),
      shown: ["noMatchingAccelerator"],
    },
    {
      case: "two cards per replica but one free card per node",
      cluster: plainGpuCluster({ allFree: true }),
      resources: formResources({ gpu: 2 }),
      shown: ["noNodeCanScheduleFullGpuRequest"],
    },
    {
      case: "more full cards than are free",
      cluster: plainGpuCluster(),
      resources: formResources({ gpu: 2 }),
      shown: [
        "fullGpuCardCapacityInsufficient",
        "fullGpuResourcesInsufficient",
      ],
    },
    {
      case: "more GPU replicas than cards while CPU and memory suffice",
      cluster: plainGpuCluster({
        allFree: true,
        cpu: [16, 8, 8],
        memory: [64, 32, 32],
      }),
      replicas: 3,
      resources: formResources({ cpu: 4, memory: 20 }),
      shown: [
        "fullGpuCardCapacityInsufficient",
        "fullGpuResourcesInsufficient",
      ],
    },
    {
      case: "more half-card replicas than per-card core allows",
      cluster: fractionalSlotsCluster,
      replicas: 3,
      resources: formResources({ gpu: 0.5 }),
      shown: [
        "fractionalGpuResourcesInsufficient",
        "partialGpuReplicaPlacement",
      ],
    },
    {
      case: "more vGPU replicas than usable cards",
      cluster: oneUsableCardCluster,
      replicas: 2,
      resources: formResources({
        virtualization: { memory_mib: 4096, core_percent: 100 },
      }),
      shown: ["partialGpuReplicaPlacement", "vgpuResourcesInsufficient"],
    },
    {
      case: "more vGPU memory and core than the cluster has",
      cluster: vgpuCluster(),
      replicas: 2,
      resources: formResources({
        gpu: 2,
        virtualization: { memory_mib: 4096, core_percent: 100 },
      }),
      shown: [
        "vgpuResourcesInsufficient",
        "vgpuMemoryResourcesInsufficient",
        "vgpuCoreResourcesInsufficient",
      ],
    },
    {
      case: "two vGPU cards per replica on nodes with one card each",
      cluster: vgpuCluster({
        free: [
          { memory_mib: 7680, core_units: 100 },
          { memory_mib: 7680, core_units: 100 },
        ],
      }),
      resources: formResources({ gpu: 2, virtualization: quarterCard }),
      shown: ["vgpuResourcesInsufficient", "noNodeCanScheduleVgpuRequest"],
    },
    {
      case: "more CPU than any GPU node has",
      cluster: plainGpuCluster({ allFree: true, cpu: [2, 1, 1] }),
      resources: formResources({ cpu: 2 }),
      shown: ["noNodeCanScheduleCpuRequest"],
    },
    {
      case: "more CPU than the cluster has",
      cluster: plainGpuCluster({ allFree: true, cpu: [2, 1, 1] }),
      resources: formResources({ cpu: 3 }),
      shown: ["cpuResourcesInsufficient"],
    },
    {
      case: "more memory than any GPU node has",
      cluster: plainGpuCluster({ allFree: true, memory: [16, 8, 8] }),
      resources: formResources({ memory: 16 }),
      shown: ["noNodeCanScheduleMemoryRequest"],
    },
    {
      case: "CPU and memory that only fit on different nodes",
      cluster: plainGpuCluster({
        allFree: true,
        cpu: [5, 4, 1],
        memory: [5, 1, 4],
      }),
      resources: formResources({ cpu: 4, memory: 4 }),
      shown: ["noNodeCanScheduleCombinedResourceRequest"],
    },
  ])(
    "blocks $case and says why",
    async ({ cluster, replicas = 1, resources, shown }) => {
      const { result } = renderEndpointForm("create", { clusters: [cluster] });

      setValues(result, {
        "spec.cluster": cluster.metadata.name,
        "spec.replicas.num": replicas,
        "spec.resources": resources,
      });

      await waitFor(() => expect(result.current.submitBlocked).toBe(true));
      expect(shownMessages()).toEqual(shown);
    },
  );

  describe("while editing, counts what the endpoint already holds", () => {
    it("checks only the full cards added beyond the current ones", async () => {
      refineForm.queryData = {
        metadata: metadata("full-card"),
        spec: {
          cluster: "vgpu",
          replicas: { num: 1 },
          resources: backendResources(),
        },
        status: null,
      };
      const { result } = renderEndpointForm("edit", {
        clusters: [vgpuCluster()],
      });
      setValues(result, {
        "spec.cluster": "vgpu",
        "spec.resources": formResources(),
      });

      await waitFor(() => expect(currentRequest()).toContain("1.0 / 1.0"));
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();

      setValues(result, { "spec.resources.gpu": 2 });
      await screen.findByText(
        "endpoints.messages.fullGpuResourcesInsufficient",
      );
    });

    it("keeps an unchanged shared-card vGPU endpoint saveable but checks a scale-out", async () => {
      // Two replicas recorded on the same card, which the current residual
      // capacity could not place again from scratch.
      const card = { memory_mib: 4096, core_percent: 100 };
      refineForm.queryData = {
        metadata: metadata("shared-card"),
        spec: {
          cluster: "one-usable-card",
          replicas: { num: 2 },
          resources: backendResources({ virtualization: card }),
        },
        status: {
          resources: {
            replicas: [
              allocation("node-a", "GPU-a", 4096, 100),
              { ...allocation("node-a", "GPU-a", 4096, 100), instance_id: "b" },
            ],
            summary: {
              products: { [T4]: { memory_mib: 8192, core_units: 200 } },
            },
          },
        },
      };
      const { result } = renderEndpointForm("edit", {
        clusters: [oneUsableCardCluster],
      });
      setValues(result, {
        "spec.cluster": "one-usable-card",
        "spec.replicas.num": 2,
        "spec.resources": formResources({ virtualization: card }),
      });

      await waitFor(() => expect(currentRequest()).toContain("2.0 / 2.0"));
      expect(result.current.submitBlocked).toBe(false);

      setValues(result, { "spec.replicas.num": 3 });

      await waitFor(() => expect(currentRequest()).toContain("3.0 / 2.0"));
      expect(result.current.submitBlocked).toBe(true);
      screen.getByText("endpoints.messages.vgpuResourcesInsufficient");
    });

    it("reuses the recorded vGPU usage when the cluster reports no devices", async () => {
      const card = { memory_mib: 8192, core_percent: 50 };
      refineForm.queryData = {
        metadata: metadata("summary-only"),
        spec: {
          cluster: "vgpu-aggregate",
          replicas: { num: 1 },
          resources: backendResources({ virtualization: card }),
        },
        status: {
          resources: {
            summary: {
              products: { [T4]: { memory_mib: 8192, core_units: 50 } },
            },
          },
        },
      };
      const { result } = renderEndpointForm("edit", {
        clusters: [vgpuAggregateCluster],
      });
      setValues(result, {
        "spec.cluster": "vgpu-aggregate",
        "spec.resources.gpu": 2,
      });

      await waitFor(() => expect(currentRequest()).toContain("2.0 / 2.0"));
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();

      setValues(result, { "spec.resources.gpu": 3 });

      await waitFor(() => expect(currentRequest()).toContain("3.0 / 2.0"));
      screen.getByText("endpoints.messages.vgpuResourcesInsufficient");
    });

    // 12 CPUs fit only with the endpoint's own 4 back on node-a.
    it.each([
      {
        cachePool: undefined,
        recordedReplicas: 2,
        on: ["node-a"],
        blocked: false,
      },
      {
        cachePool: ["node-a"],
        recordedReplicas: 1,
        on: ["node-a"],
        blocked: false,
      },
      {
        cachePool: ["node-a"],
        recordedReplicas: 1,
        on: ["node-b"],
        blocked: true,
      },
      {
        cachePool: ["node-a"],
        recordedReplicas: 2,
        on: ["node-a", "node-b"],
        blocked: false,
      },
    ])(
      "credits CPU held on $on with cache pool $cachePool: blocked $blocked",
      async ({ cachePool, recordedReplicas, on, blocked }) => {
        refineForm.queryData = {
          metadata: metadata("cpu-edit"),
          spec: {
            cluster: "plain-gpu",
            replicas: { num: recordedReplicas },
            resources: backendResources({ cpu: 4 }),
          },
          status: {
            resources: { replicas: on.map((node) => allocation(node)) },
          },
        };
        const { result } = renderEndpointForm("edit", {
          clusters: [plainGpuCluster({ cacheNodes: cachePool })],
        });

        setValues(result, {
          "spec.cluster": "plain-gpu",
          ...(cachePool && {
            "spec.kv_cache": {
              provider: "zcache",
              options: { timeout_seconds: 2 },
            },
          }),
          "spec.replicas.num": 1,
          "spec.resources": formResources({ cpu: 12 }),
        });

        await waitFor(() => expect(result.current.submitBlocked).toBe(blocked));
      },
    );
  });
});

describe("simplified recipe deploy on vGPU clusters", () => {
  // The virtual-card split and its capacity feedback are deploy essentials on
  // a vGPU cluster, so they stay outside "Show all options".
  it("keeps the vGPU split and current request visible", () => {
    const { result } = renderEndpointForm("create", {
      catalogs: [catalogA, recipeCatalog()],
      clusters: [vgpuCluster()],
    });
    selectCatalog("recipe-mc");

    setValues(result, {
      "spec.cluster": "vgpu",
      "spec.resources.accelerator": { type: "nvidia_gpu", product: T4 },
    });

    expect(screen.queryByTestId("field-spec.model.version")).toBeNull();
    screen.getByTestId("endpoint-virtual-card-split-group");
    screen.getByTestId("endpoint-current-request-panel");
  });

  it("has no vGPU split on other clusters", () => {
    const { result } = renderEndpointForm("create", {
      catalogs: [catalogA, recipeCatalog()],
      clusters: [plainGpuCluster()],
    });
    selectCatalog("recipe-mc");

    setValues(result, { "spec.cluster": "plain-gpu" });

    expect(
      screen.queryByTestId("endpoint-virtual-card-split-group"),
    ).toBeNull();
  });
});

describe("submit transform", () => {
  it("submits backend-compatible flat vGPU resource keys", async () => {
    const { result } = renderEndpointForm("edit");
    const virtualization = { memory_mib: 8192, core_percent: 50 };
    setValues(result, {
      "metadata.name": "vgpu-endpoint",
      "spec.resources": formResources({ virtualization }),
    });

    const submitted = await submit(result);

    expect(submitted.spec.resources).toEqual(
      backendResources({ virtualization }),
    );
  });

  it("submits JSON object engine_args as structured values", async () => {
    const { result } = renderEndpointForm("edit");
    setValues(result, {
      "metadata.name": "json-args",
      "spec.variables.engine_args": {
        speculative_config: '{"method":"mtp","nested":{"enabled":true}}',
        max_model_len: "4096",
      },
    });

    const submitted = await submit(result);

    expect(submitted.spec.variables.engine_args).toEqual({
      speculative_config: { method: "mtp", nested: { enabled: true } },
      max_model_len: "4096",
    });
  });
});

describe("catalog selection", () => {
  it("applies the catalog's values", async () => {
    const { result } = renderEndpointForm();

    selectCatalog("vllm-llama");

    await waitFor(() =>
      expect(result.current.form.getValues().spec).toMatchObject({
        model: {
          name: "llama-3",
          version: "1.0",
          registry: "hf",
          file: "model.bin",
        },
        engine: { engine: "vllm", version: "0.6.0" },
        resources: { cpu: "4", memory: "8" },
        replicas: { num: 2 },
        deployment_options: { scheduler: { type: "roundrobin" } },
      }),
    );
  });

  it("falls back to defaults for what the next catalog leaves out", async () => {
    const { result } = renderEndpointForm();
    selectCatalog("vllm-llama");
    await waitFor(() =>
      expect(fieldValue(result, "spec.replicas.num")).toBe(2),
    );

    selectCatalog("llama-cpp-basic");

    await waitFor(() =>
      expect(result.current.form.getValues().spec).toMatchObject({
        resources: { cpu: "0", memory: "0", gpu: "0" },
        replicas: { num: 1 },
        model: { name: "tiny-model" },
        engine: { engine: "llama-cpp" },
      }),
    );
  });

  it("resets everything on None and still accepts a catalog after", async () => {
    const { result } = renderEndpointForm();
    selectCatalog("vllm-llama");
    await waitFor(() =>
      expect(fieldValue(result, "spec.model.name")).toBe("llama-3"),
    );

    selectCatalog("common.options.none");

    await waitFor(() =>
      expect(result.current.form.getValues().spec).toMatchObject({
        model: { name: "", file: "", registry: "" },
        engine: { engine: "", version: "" },
        resources: { cpu: "0", memory: "0" },
        replicas: { num: 1 },
        deployment_options: { scheduler: { type: "consistent_hash" } },
      }),
    );

    selectCatalog("llama-cpp-basic");
    await waitFor(() =>
      expect(fieldValue(result, "spec.model.name")).toBe("tiny-model"),
    );
  });
});

describe("validation", () => {
  it("defaults the scheduler type and requires one", async () => {
    const { result } = renderEndpointForm();
    expect(fieldValue(result, "spec.deployment_options.scheduler.type")).toBe(
      "consistent_hash",
    );

    setValues(result, { "spec.deployment_options.scheduler.type": "" });
    await validate(result);

    expect(
      result.current.form.formState.errors?.[
        "spec.deployment_options.scheduler.type" as never
      ],
    ).toMatchObject({ message: "endpoints.messages.schedulerTypeRequired" });
  });

  it.each([
    { workspace: "_all_", error: true },
    { workspace: "ws-alpha", error: false },
  ])("workspace $workspace -> error: $error", async ({ workspace, error }) => {
    vi.mocked(useWorkspace).mockReturnValue({ current: workspace } as never);
    const { result } = renderEndpointForm();

    await validate(result, "metadata.workspace");

    expect(
      screen.queryByText("common.validation.workspaceRequired") !== null,
    ).toBe(error);
  });

  it.each([
    { gpu: 1.5, cluster: "kubernetes", error: true },
    { gpu: 0, cluster: "kubernetes", error: false },
    { gpu: 2, cluster: "kubernetes", error: false },
    { gpu: 1.5, cluster: "ssh", error: true },
    { gpu: 0.5, cluster: "ssh", error: false },
    { gpu: 0.15, cluster: "ssh", error: true },
  ])(
    "GPU count $gpu on $cluster -> error: $error",
    async ({ gpu, cluster, error }) => {
      const { result } = renderEndpointForm("create", {
        clusters: [plainGpuCluster({ name: cluster, type: cluster })],
      });
      setValues(result, {
        "spec.cluster": cluster,
        "spec.resources": formResources({ cpu: 1, memory: 4, gpu }),
      });

      await validate(result, "spec.resources.gpu");

      const message =
        cluster === "ssh"
          ? "endpoints.messages.gpuCountPrecisionSsh"
          : "endpoints.messages.gpuCountPrecisionK8s";
      expect(screen.queryByText(message) !== null).toBe(error);
    },
  );

  // The existence check reads an exact-name lookup, not whatever page the
  // dropdown last fetched. Its result arrives after the form has rendered, so
  // re-validating on it must not loop: the Refine form wrapper is a new object
  // on every render.
  describe("model existence", () => {
    // Routes by search term: the dropdown list stays empty while the
    // exact-name lookup is controlled. A null page is "no answer yet".
    function mockExistenceLookup(found: { name: string }[] | null) {
      vi.mocked(useRegistryModels).mockImplementation(((opts: {
        search?: string;
      }) =>
        opts.search === "llama-3" && found
          ? registryModelsResult(found, { models: found, total: found.length })
          : registryModelsResult()) as unknown as typeof useRegistryModels);
    }

    it("flags a model the lookup does not find, without further input", async () => {
      mockExistenceLookup([{ name: "some-other-model" }]);
      renderEndpointForm();

      selectCatalog("vllm-llama");

      await screen.findByText("endpoints.messages.modelNotFoundInRegistry");
    });

    it.each([
      { case: "the lookup finds the model", found: [{ name: "llama-3" }] },
      { case: "the lookup has not answered", found: null },
    ])("accepts the model when $case", async ({ found }) => {
      mockExistenceLookup(found);
      const { result } = renderEndpointForm();
      selectCatalog("vllm-llama");

      await validate(result);

      expect(
        screen.queryByText("endpoints.messages.modelNotFoundInRegistry"),
      ).toBeNull();
    });
  });
});

describe("unverified accelerator fallback", () => {
  // The recipe's hardware-verified list is advice: when none of its GPUs are
  // in the cluster, the picker falls back to every accelerator with a notice.
  const verifiedRecipe = (verified: string) =>
    recipeCatalog({
      annotations: { "recipe.vllm.ai/hardware-verified": verified },
      variant: { vram_minimum_gb: 4 },
    });

  it.each([
    { verified: "H100", notice: true },
    { verified: "T4", notice: false },
  ])(
    "verified $verified: picker usable, notice $notice",
    ({ verified, notice }) => {
      const { result } = renderEndpointForm("create", {
        catalogs: [catalogA, verifiedRecipe(verified)],
        clusters: [plainGpuCluster()],
      });
      selectCatalog("recipe-mc");
      setValues(result, { "spec.cluster": "plain-gpu" });

      // The combobox is disabled whenever it has no options.
      const trigger = screen
        .getByTestId("field-spec.resources.accelerator")
        .querySelector('button[role="combobox"]') as HTMLButtonElement;
      expect(trigger.disabled).toBe(false);
      expect(
        screen.queryByTestId("endpoint-accelerator-unverified-notice") !== null,
      ).toBe(notice);
    },
  );

  it("shows no notice on a cluster without accelerators", () => {
    const { result } = renderEndpointForm("create", {
      catalogs: [catalogA, verifiedRecipe("H100")],
      clusters: [noResourceCluster],
    });
    selectCatalog("recipe-mc");
    setValues(result, { "spec.cluster": "no-resources" });

    expect(
      screen.queryByTestId("endpoint-accelerator-unverified-notice"),
    ).toBeNull();
  });
});

describe("validated accelerators are ranked, not filtered", () => {
  const optionsFor = (verified: string) => {
    const { result } = renderEndpointForm("create", {
      catalogs: [
        catalogA,
        recipeCatalog({
          annotations: { "recipe.vllm.ai/hardware-verified": verified },
        }),
      ],
      clusters: [plainGpuCluster({ extraProducts: { "A100-SXM4": 1 } })],
    });
    selectCatalog("recipe-mc");
    setValues(result, { "spec.cluster": "plain-gpu" });
    openCombobox("spec.resources.accelerator");
    return screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
  };

  it("offers the cards the recipe does not name, ranked below the ones it does", () => {
    const labels = optionsFor("T4");

    expect(labels.findIndex((label) => label.includes("T4"))).toBeLessThan(
      labels.findIndex((label) => label.includes("A100")),
    );
  });

  it("marks the ones the recipe names, and only those", () => {
    const labels = optionsFor("T4");
    const marked = (product: string) =>
      labels
        .find((label) => label.includes(product))
        ?.includes("endpoints.recipe.verifiedAccelerator");

    expect(marked("T4")).toBe(true);
    expect(marked("A100")).toBe(false);
  });
});

describe("what the chosen registry costs at deploy time", () => {
  it.each([
    {
      case: "public",
      registries: [{ visibility: "public" }],
      shown: "endpoint-runtime-download-hint",
    },
    { case: "private", registries: [{ visibility: "private" }], shown: null },
    // visibility is a computed field: a request that drops
    // MODEL_REGISTRY_SELECT gets undefined, which must not read as local.
    {
      case: "unstated",
      registries: [{}],
      shown: "endpoint-runtime-download-unknown",
    },
    { case: "not loaded yet", registries: [], shown: null },
  ])("$case registry -> $shown", ({ registries, shown }) => {
    const { result } = renderEndpointForm("create", {
      registries: registries.map((registry) => ({
        metadata: { name: "reg" },
        ...registry,
      })),
    });

    setValues(result, { "spec.model.registry": "reg" });

    for (const testId of [
      "endpoint-runtime-download-hint",
      "endpoint-runtime-download-unknown",
    ]) {
      expect(screen.queryByTestId(testId) !== null).toBe(testId === shown);
    }
  });
});

describe("engines that need no model spec", () => {
  const modelFieldLabels = [
    "endpoints.fields.modelRegistry",
    "endpoints.fields.modelName",
    "endpoints.fields.modelVersion",
    "endpoints.fields.modelFile",
    "endpoints.fields.taskType",
  ];
  const lists = {
    catalogs: [],
    registries: [{ metadata: { name: "mine" } }],
    engines: [engineRef("flex"), engineRef("vllm")],
  };

  it.each([
    { engine: "flex", shown: false },
    { engine: "vllm", shown: true },
  ])("$engine: model fields shown $shown", ({ engine, shown }) => {
    const { result } = renderEndpointForm("create", lists);

    setValues(result, { "spec.engine": { engine, version: "v1" } });

    for (const label of modelFieldLabels) {
      expect(screen.queryByText(label) !== null).toBe(shown);
    }
    screen.getByText("endpoints.fields.replicas");
  });

  // With the fields hidden there is nothing to flag and nothing the user could
  // fix, so a registry the workspace lacks must not block Save.
  it.each([
    { engine: "flex", flagged: false },
    { engine: "vllm", flagged: true },
  ])(
    "$engine: flags a registry the workspace lacks $flagged",
    async ({ engine, flagged }) => {
      const { result } = renderEndpointForm("create", lists);
      setValues(result, {
        "spec.engine": { engine, version: "v1" },
        "spec.model.registry": "huggingface",
      });

      await validate(result);

      const errors = result.current.form.formState.errors as Record<
        string,
        { message?: string } | undefined
      >;
      expect(errors["spec.model.registry"] !== undefined).toBe(flagged);
      expect(errors["-model-catalog"]).toBeUndefined();
    },
  );

  it("submits no model beyond the task the engine set", async () => {
    const { result } = renderEndpointForm("create", lists);
    setValues(result, {
      "spec.engine": { engine: "flex", version: "v1" },
      "spec.model": {
        registry: "huggingface",
        name: "Qwen/Qwen2.5-0.5B-Instruct",
        version: "main",
        file: "",
        task: "text-generation",
        info: null,
      },
    });

    const submitted = await submit(result);

    expect(submitted.spec.model).toEqual({
      ...defaultEndpointSpec.model,
      task: "text-generation",
    });
  });
});

describe("model picker", () => {
  const qwen = (alias?: string) => ({
    name: "Qwen/Qwen3-8B",
    versions: [{ name: "v2", creation_time: "", ...(alias && { alias }) }],
  });

  async function pickModel(result: Rendered, option: string) {
    setValues(result, { "spec.model.registry": "hf" });
    await act(async () => {
      openCombobox("spec.model.name");
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: option }));
    });
  }

  // Renaming the alias later must leave the endpoint pointing where it was.
  it("labels a model by its alias but submits the physical name", async () => {
    vi.mocked(useRegistryModels).mockReturnValue(
      registryModelsResult([qwen("qwen-chat")]),
    );
    const { result } = renderEndpointForm("create", {
      registries: [{ metadata: { name: "hf" } }],
    });

    await pickModel(result, "qwen-chat");

    expect(fieldValue(result, "spec.model.name")).toBe("Qwen/Qwen3-8B");
    expect(fieldValue(result, "spec.model.version")).toBe("");
  });

  // The controller's field belongs to the combobox alone: a wrapper around it
  // would take the search box's keystrokes as changes to the model name.
  it("keeps the search term out of the model name when picking a model that is not on the first page", async () => {
    const deep = "tc6-a-24-20260830230732";
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      name: `tc6-a-${String(index).padStart(2, "0")}-20260830230732`,
      versions: [{ name: "v1", creation_time: "" }],
    }));
    vi.mocked(useRegistryModels).mockImplementation(((opts: {
      search?: string;
    }) => {
      const models = opts.search
        ? [{ name: deep, versions: [] }, ...firstPage].filter((model) =>
            model.name.includes(opts.search as string),
          )
        : firstPage;
      return registryModelsResult(models, {
        models,
        total: models.length,
        limit: 20,
        freshness: null,
      });
    }) as unknown as typeof useRegistryModels);
    const { result } = renderEndpointForm("create", {
      registries: [{ metadata: { name: "hf" } }],
    });
    setValues(result, { "spec.model.registry": "hf" });
    await act(async () => {
      openCombobox("spec.model.name");
    });

    // With the exact name searched, the option reads as the current value and
    // clicking it would unselect.
    await act(async () => {
      fireEvent.change(
        document.querySelector("input[cmdk-input]") as HTMLInputElement,
        { target: { value: deep } },
      );
    });
    expect(fieldValue(result, "spec.model.name")).toBe("");

    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: deep }));
    });
    expect(fieldValue(result, "spec.model.name")).toBe(deep);
  });

  describe("static parameters", () => {
    it("fills them in from the detail read when a model is picked", async () => {
      vi.mocked(useRegistryModels).mockReturnValue(
        registryModelsResult([qwen()]),
      );
      vi.mocked(useRegistryModelVersion).mockReturnValue(
        modelVersionResult({
          name: "v2",
          creation_time: "",
          info: { parameter_count: "8B", num_hidden_layers: 36 },
        }),
      );
      const { result } = renderEndpointForm("create", {
        registries: [{ metadata: { name: "hf" } }],
      });

      await pickModel(result, "Qwen/Qwen3-8B");

      expect(fieldValue(result, "spec.model.info")).toEqual({
        parameter_count: "8B",
        num_hidden_layers: 36,
      });
    });

    // The previous model's numbers must not stay while the new read is in
    // flight, and a read that fails settles with nothing.
    it.each([
      { case: "in flight", read: modelVersionResult(null, true) },
      { case: "empty", read: modelVersionResult() },
    ])("clears them while the detail read is $case", async ({ read }) => {
      vi.mocked(useRegistryModels).mockReturnValue(
        registryModelsResult([qwen()]),
      );
      vi.mocked(useRegistryModelVersion).mockReturnValue(read);
      const { result } = renderEndpointForm("create", {
        registries: [{ metadata: { name: "hf" } }],
      });
      setValues(result, { "spec.model.info": { parameter_count: "72B" } });

      await pickModel(result, "Qwen/Qwen3-8B");

      expect(fieldValue(result, "spec.model.info")).toBeNull();
    });
  });
});

describe("registry choice", () => {
  const lists = {
    registries: [
      { metadata: { name: "live" }, status: { phase: "Connected" } },
      { metadata: { name: "down" }, status: { phase: "Failed" } },
    ],
  };

  // Removing an unreachable registry would leave the user looking for one
  // they know they created.
  it.each([
    { registry: "live", chosen: "live" },
    { registry: "down", chosen: "" },
  ])(
    "offers $registry and picking it chooses $chosen",
    async ({ registry, chosen }) => {
      const { result } = renderEndpointForm("create", lists);
      await act(async () => {
        openCombobox("spec.model.registry");
      });
      const option = screen
        .getAllByRole("option")
        .find((candidate) => candidate.textContent?.startsWith(registry));
      if (!option) throw new Error(`${registry} missing from the list`);

      await act(async () => {
        fireEvent.click(option);
      });

      expect(fieldValue(result, "spec.model.registry")).toBe(chosen);
    },
  );

  it.each([
    { registry: "someone-elses", flagged: true },
    { registry: "mine", flagged: false },
  ])(
    "flags a registry the workspace lacks: $registry -> $flagged",
    async ({ registry, flagged }) => {
      const { result } = renderEndpointForm("create", {
        registries: [{ metadata: { name: "mine" } }],
      });
      setValues(result, { "spec.model.registry": registry });
      // A separate pass: the resolver closes over the previous render's value.
      await validate(result);

      const error = (
        result.current.form.formState.errors as Record<
          string,
          { message?: string } | undefined
        >
      )["spec.model.registry"];
      if (flagged) {
        expect(error?.message).toMatch(
          /^endpoints\.messages\.modelRegistryNotInWorkspace/,
        );
      } else {
        expect(error).toBeUndefined();
      }
    },
  );
});

describe("what a deploy came from is recorded on the endpoint", () => {
  const lists = {
    catalogs: [catalogA, recipeCatalog()],
    clusters: [noResourceCluster],
  };

  it.each([
    { catalog: "recipe-mc", variant: "default" },
    { catalog: "vllm-llama", variant: undefined },
  ])(
    "names catalog $catalog and variant $variant",
    async ({ catalog, variant }) => {
      const { result } = renderEndpointForm("create", lists);
      selectCatalog(catalog);

      const { annotations } = (await submit(result)).metadata;

      expect(annotations["neutree.ai/model-catalog"]).toBe(catalog);
      expect(annotations["neutree.ai/model-catalog-variant"]).toBe(variant);
    },
  );

  it("records nothing when the endpoint was not deployed from a catalog", async () => {
    const { result } = renderEndpointForm("create", lists);

    const submitted = await submit(result);

    expect(
      submitted.metadata.annotations?.["neutree.ai/model-catalog"],
    ).toBeUndefined();
  });
});

describe("recipe catalogs", () => {
  const renderRecipe = (recipe = recipeCatalog(), registries?: unknown[]) => {
    const rendered = renderEndpointForm("create", {
      catalogs: [catalogA, recipe],
      clusters: [noResourceCluster],
      registries,
    });
    selectCatalog(recipe.metadata.name);
    return rendered;
  };

  // A catalog refetch is a change with no variant or feature event attached.
  it("re-composes the form when the selected catalog's data refetches", () => {
    const { result } = renderRecipe();
    expect(fieldValue(result, "spec.model.name")).toBe("org/recipe-model");

    mockLists({
      catalogs: [
        catalogA,
        recipeCatalog({
          model: { name: "org/local-recipe-model", registry: "local" },
        }),
      ],
      clusters: [noResourceCluster],
    });
    // Any watched change re-renders the hook with the refetched list.
    setValues(result, { "metadata.workspace": "default" });

    expect(fieldValue(result, "spec.model.name")).toBe(
      "org/local-recipe-model",
    );
    expect(fieldValue(result, "spec.model.registry")).toBe("local");
  });

  // The simplified form folds engine, args and env away; the preview is the
  // only place left to see what the deploy will run.
  describe("the composition preview", () => {
    it("summarises the composed engine without expanding anything", () => {
      renderRecipe();

      const toggle = screen.getByTestId("compose-preview-toggle");
      for (const text of ["vllm", "0.8.5", "text-generation"]) {
        expect(toggle.textContent).toContain(text);
      }
    });

    it("opens to the full composition", () => {
      renderRecipe();
      expect(screen.getByTestId("compose-preview").textContent).not.toContain(
        "org/recipe-model",
      );

      fireEvent.click(screen.getByTestId("compose-preview-toggle"));

      expect(screen.getByTestId("compose-preview").textContent).toContain(
        "org/recipe-model",
      );
    });

    it("is not folded once the advanced options are shown", async () => {
      renderRecipe();

      await act(async () => {
        fireEvent.click(screen.getByText("endpoints.simplified.showAdvanced"));
      });

      expect(screen.queryByTestId("compose-preview-toggle")).toBeNull();
      expect(screen.getByTestId("compose-preview").textContent).toContain(
        "org/recipe-model",
      );
    });
  });

  describe("model metadata", () => {
    // The estimate reads the form's copy of the model metadata, and that copy
    // is submitted, so a catalog stating none must clear the last one's.
    it.each([
      { next: undefined, info: null },
      { next: { parameter_count: "8B" }, info: { parameter_count: "8B" } },
    ])(
      "switching to a catalog stating $next leaves $info",
      ({ next, info }) => {
        const first = recipeCatalog({
          id: 91,
          name: "first",
          model: { name: "a", info: { parameter_count: "35B" } },
        });
        const second = recipeCatalog({
          id: 92,
          name: "second",
          model: { name: "b", ...(next && { info: next }) },
        });
        const { result } = renderEndpointForm("create", {
          catalogs: [first, second],
          clusters: [noResourceCluster],
        });

        selectCatalog("first");
        expect(fieldValue(result, "spec.model.info")).toEqual({
          parameter_count: "35B",
        });
        selectCatalog("second");

        expect(fieldValue(result, "spec.model.info")).toEqual(info);
      },
    );
  });
});

describe("the weights estimate", () => {
  const checkpointShape = {
    num_hidden_layers: 32,
    num_key_value_heads: 8,
    head_dim: 128,
  };

  const withModel = (result: Rendered, info: unknown = checkpointShape) =>
    setValues(result, {
      "spec.model.registry": "hf",
      "spec.model.name": "org/model",
      "spec.model.info": info,
    });

  it("estimates the KV cache with no catalog in play, offering both fields", () => {
    const { result } = renderEndpointForm("create", {
      registries: [{ metadata: { name: "hf" } }],
    });

    withModel(result, checkpointShape);

    screen.getByTestId("endpoint-weights-estimate");
    screen.getByTestId("kv-cache-estimate");
    expect(screen.queryByTestId("endpoint-declared-weights")).toBeNull();
    expect(screen.getByTestId("kv-cache-tokens").tagName).toBe("INPUT");
    expect(screen.getByTestId("kv-cache-sequences").tagName).toBe("INPUT");
  });

  it("puts what the catalog declares beside the estimate, giving way to the VRAM check", () => {
    renderEndpointForm("create", {
      catalogs: [
        catalogA,
        recipeCatalog({
          variant: { vram_minimum_gb: 48 },
          model: { info: { parameter_count: "35B" } },
        }),
      ],
      clusters: [noResourceCluster],
    });
    selectCatalog("recipe-mc");

    const block = screen.getByTestId("endpoint-declared-weights");
    within(block).getByTestId("vram-check-badge");
    expect(within(block).queryByText("35B")).toBeNull();
  });

  // Flex serves a model baked into its own image: no checkpoint to compute a
  // cache from, even when an existing spec carries model info.
  it("drops the estimate for an engine that needs no model spec", () => {
    const { result } = renderEndpointForm("create", {
      catalogs: [],
      registries: [{ metadata: { name: "hf" } }],
      engines: [engineRef("flex"), engineRef("vllm")],
    });

    setValues(result, { "spec.engine": { engine: "vllm", version: "v1" } });
    withModel(result);
    screen.getByTestId("kv-cache-estimate");

    setValues(result, { "spec.engine": { engine: "flex", version: "v1" } });
    withModel(result);
    expect(screen.queryByTestId("kv-cache-estimate")).toBeNull();
  });

  // A catalog variant states display metadata (parameter count,
  // quantization), not the shape the cache arithmetic needs.
  it.each([
    { case: "the picked checkpoint", stated: {}, picked: true },
    { case: "what the catalog states", stated: checkpointShape, picked: false },
  ])("estimates from $case", ({ stated, picked }) => {
    const { result } = renderEndpointForm("create", {
      catalogs: [
        catalogA,
        recipeCatalog({
          model: {
            info: { parameter_count: "35B", quantization: "fp8", ...stated },
          },
        }),
      ],
      clusters: [noResourceCluster],
      registries: [{ metadata: { name: "hf" } }],
    });
    selectCatalog("recipe-mc");

    if (picked) withModel(result);

    expect(
      screen.getByTestId("kv-cache-estimate").getAttribute("data-state"),
    ).not.toBe("missing-fields");
  });

  // A recipe exposing the context window as a feature must not offer it a
  // second time as an estimate field.
  it("reads the context from a recipe feature instead of offering a field", () => {
    renderEndpointForm("create", {
      catalogs: [
        catalogA,
        recipeCatalog({
          model: { info: checkpointShape },
          features: [
            {
              name: "max-model-len",
              display_name: "Context window",
              group: "Core",
              type: "input",
              input: { value_type: "int", default: "8192" },
              engine_args: { max_model_len: "${value}" },
            },
          ],
        }),
      ],
      clusters: [noResourceCluster],
    });
    selectCatalog("recipe-mc");

    const tokens = screen.getByTestId("kv-cache-tokens");
    expect(tokens.tagName).not.toBe("INPUT");
    expect(tokens.getAttribute("data-owned-by")).toBe("Context window");
    expect(tokens.textContent).toBe("8,192");
    expect(screen.getByTestId("kv-cache-sequences").tagName).toBe("INPUT");
  });
});
