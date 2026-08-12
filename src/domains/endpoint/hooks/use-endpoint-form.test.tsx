import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { FormProvider } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

// cmdk and Radix components use APIs missing from jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

const refineCoreOnFinishMock = vi.hoisted(() => vi.fn());
const useFormOptionsRef = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const queryDataRef = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      useFormOptionsRef.current = opts;
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      const form = rhf.useForm(rhfOpts);
      // Like the real @refinedev/react-hook-form useForm, return a NEW object
      // every render (it spreads the RHF result). Effects in the hook must not
      // rely on the wrapper's identity being stable — depending on it while
      // also updating form state on every run loops forever (NEU-503 freeze).
      return {
        ...form,
        refineCore: {
          onFinish: refineCoreOnFinishMock,
          query: queryDataRef.current
            ? { data: { data: queryDataRef.current } }
            : undefined,
        },
      };
    },
  };
});

vi.mock("@refinedev/core", () => ({
  useSelect: vi.fn(),
}));

// The registry-models listing is shared L1 infrastructure now, so the model
// dropdown and the exact-name existence lookup are both mocked here.
vi.mock("@/foundation/hooks/use-registry-models", () => ({
  useRegistryModels: vi.fn(),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

const mockUseWorkspace = vi.fn(() => ({ current: "default" }));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => mockUseWorkspace(),
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
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import { useEndpointForm } from "./use-endpoint-form";

// --- Fixtures ---

const metadata = (name: string) => ({
  name,
  workspace: "default",
  deletion_timestamp: null,
  creation_timestamp: "",
  update_timestamp: "",
  labels: {},
  annotations: {},
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

// Recipe-shaped MC (has variants) — selecting it activates simplified mode.
const recipeCatalog = {
  id: 3,
  metadata: { name: "recipe-mc" },
  spec: {
    engine: { engine: "vllm", version: "0.8.5" },
    variants: {
      default: {
        model: {
          name: "org/recipe-model",
          version: "",
          registry: "hf",
          file: "",
          task: "text-generation",
        },
      },
    },
  },
};

// --- Mocks setup ---

const plainKubernetesCluster = {
  metadata: metadata("plain-k8s"),
  spec: { type: "kubernetes" },
  status: { resource_info: null },
} satisfies EndpointClusterRef;

const nonVirtualizedResourceInfo = {
  allocatable: {
    cpu: 32,
    memory: 128,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 4,
        product_groups: { "Tesla-T4": 4 },
      },
    },
  },
  available: {
    cpu: 20,
    memory: 96,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 2,
        product_groups: { "Tesla-T4": 2 },
      },
    },
  },
  node_resources: {
    "node-a": {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: { "Tesla-T4": 2 },
          },
        },
      },
      available: {
        cpu: 10,
        memory: 48,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: { "Tesla-T4": 1 },
          },
        },
      },
    },
    "node-b": {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: { "Tesla-T4": 2 },
          },
        },
      },
      available: {
        cpu: 10,
        memory: 48,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: { "Tesla-T4": 1 },
          },
        },
      },
    },
  },
} satisfies NonNullable<
  NonNullable<EndpointClusterRef["status"]>["resource_info"]
>;

const nonVirtualizedResourceInfoWithDevices = {
  ...nonVirtualizedResourceInfo,
  node_resources: {
    "node-a": {
      ...nonVirtualizedResourceInfo.node_resources["node-a"],
      devices: [
        {
          uuid: "GPU-non-vgpu-free",
          product: "Tesla-T4",
          health: true,
          allocatable: {
            memory_mib: 15360,
            core_units: 100,
          },
          available: {
            memory_mib: 15360,
            core_units: 100,
          },
        },
      ],
    },
    "node-b": {
      ...nonVirtualizedResourceInfo.node_resources["node-b"],
      devices: [
        {
          uuid: "GPU-non-vgpu-allocated",
          product: "Tesla-T4",
          health: true,
          allocatable: {
            memory_mib: 15360,
            core_units: 100,
          },
          available: {
            memory_mib: 0,
            core_units: 0,
          },
        },
      ],
    },
  },
} satisfies NonNullable<
  NonNullable<EndpointClusterRef["status"]>["resource_info"]
>;

const cpuMemoryOnlyResourceInfo = {
  allocatable: {
    cpu: 32,
    memory: 128,
    accelerator_groups: null,
  },
  available: {
    cpu: 20,
    memory: 96,
    accelerator_groups: null,
  },
  node_resources: {
    "node-a": {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: null,
      },
      available: {
        cpu: 10,
        memory: 48,
        accelerator_groups: null,
      },
    },
    "node-b": {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: null,
      },
      available: {
        cpu: 10,
        memory: 48,
        accelerator_groups: null,
      },
    },
  },
} satisfies NonNullable<
  NonNullable<EndpointClusterRef["status"]>["resource_info"]
>;

const cpuMemoryOnlyCluster = {
  metadata: metadata("cpu-memory-only"),
  spec: { type: "kubernetes" },
  status: { resource_info: cpuMemoryOnlyResourceInfo },
} satisfies EndpointClusterRef;

const plainKubernetesClusterWithNodeResources = {
  metadata: metadata("plain-k8s-node-resources"),
  spec: { type: "kubernetes" },
  status: { resource_info: nonVirtualizedResourceInfoWithDevices },
} satisfies EndpointClusterRef;

const staticNodeClusterWithNodeResources = {
  metadata: metadata("static-node-resources"),
  spec: { type: "ssh" },
  status: { resource_info: nonVirtualizedResourceInfoWithDevices },
} satisfies EndpointClusterRef;

const virtualizedKubernetesCluster = {
  metadata: metadata("virtualized-k8s"),
  spec: {
    type: "kubernetes",
    accelerator_virtualization: { enabled: true },
  },
  status: { resource_info: null },
} satisfies EndpointClusterRef;

const virtualizedKubernetesClusterWithDevices = {
  metadata: metadata("virtualized-k8s-devices"),
  spec: {
    type: "kubernetes",
    accelerator_virtualization: { enabled: true },
  },
  status: {
    resource_info: {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 2,
                virtualization: {
                  memory_mib: 30720,
                  core_units: 200,
                },
              },
            },
          },
        },
      },
      available: {
        cpu: 12,
        memory: 48,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 1,
                virtualization: {
                  memory_mib: 15360,
                  core_units: 150,
                },
              },
            },
          },
        },
      },
      node_resources: {
        "node-a": {
          allocatable: {
            cpu: 16,
            memory: 64,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 2,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 2,
                    virtualization: {
                      memory_mib: 30720,
                      core_units: 200,
                    },
                  },
                },
              },
            },
          },
          available: {
            cpu: 12,
            memory: 48,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 1,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 1,
                    virtualization: {
                      memory_mib: 15360,
                      core_units: 150,
                    },
                  },
                },
              },
            },
          },
          devices: [
            {
              uuid: "GPU-11111111-2222-3333-4444-555555555555",
              product: "Tesla-T4",
              health: true,
              allocatable: {
                memory_mib: 15360,
                core_units: 100,
              },
              available: {
                memory_mib: 7680,
                core_units: 50,
              },
            },
          ],
        },
        "node-b": {
          allocatable: {
            cpu: 16,
            memory: 64,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 1,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 1,
                  },
                },
              },
            },
          },
          available: {
            cpu: 12,
            memory: 48,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 0,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 0,
                  },
                },
              },
            },
          },
          devices: [
            {
              uuid: "GPU-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
              product: "Tesla-T4",
              health: true,
              allocatable: {
                memory_mib: 15360,
                core_units: 100,
              },
              available: {
                memory_mib: 7680,
                core_units: 100,
              },
            },
          ],
        },
        "node-c": {
          allocatable: {
            cpu: 8,
            memory: 32,
            accelerator_groups: null,
          },
          available: {
            cpu: 6,
            memory: 24,
            accelerator_groups: null,
          },
          devices: [],
        },
      },
    },
  },
} satisfies EndpointClusterRef;

// Template virtualization mode (e.g. Ascend) only supports memory_mib
// shaping; core_percent is rejected by backend admission (NEU-645).
const templateModeVirtualizedKubernetesClusterWithDevices = {
  ...virtualizedKubernetesClusterWithDevices,
  metadata: metadata("template-mode-k8s-devices"),
  status: {
    ...virtualizedKubernetesClusterWithDevices.status,
    accelerator_virtualization: {
      mode: "template",
      supported_resources: ["virtualization.memory_mib"],
    },
  },
} satisfies EndpointClusterRef;

const virtualizedKubernetesClusterWithoutDeviceDetails = {
  metadata: metadata("virtualized-k8s-no-device-details"),
  spec: {
    type: "kubernetes",
    accelerator_virtualization: { enabled: true },
  },
  status: {
    ready_nodes: 2,
    resource_info: {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 2,
                virtualization: {
                  memory_mib: 30720,
                  core_units: 200,
                },
              },
            },
          },
        },
      },
      available: {
        cpu: 12,
        memory: 48,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 1,
                virtualization: {
                  memory_mib: 15360,
                  core_units: 150,
                },
              },
            },
          },
        },
      },
      node_resources: null,
    },
  },
} satisfies EndpointClusterRef;

const virtualizedKubernetesClusterWithFragmentedL20Memory = {
  metadata: metadata("virtualized-k8s-fragmented-l20-memory"),
  spec: {
    type: "kubernetes",
    accelerator_virtualization: { enabled: true },
  },
  status: {
    resource_info: {
      allocatable: {
        cpu: 64,
        memory: 256,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: null,
            products: {
              "NVIDIA-L20": {
                quantity: 2,
                virtualization: {
                  memory_mib: 92136,
                  core_units: 200,
                },
              },
            },
          },
        },
      },
      available: {
        cpu: 48,
        memory: 192,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: null,
            products: {
              "NVIDIA-L20": {
                quantity: 2,
                virtualization: {
                  memory_mib: 8168,
                  core_units: 45,
                },
              },
            },
          },
        },
      },
      accelerator_metadata: {
        nvidia_gpu: {
          products: {
            "NVIDIA-L20": {
              memory_total_mib: 46068,
            },
          },
        },
      },
      node_resources: {
        "node-l20": {
          allocatable: {
            cpu: 64,
            memory: 256,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 2,
                product_groups: null,
                products: {
                  "NVIDIA-L20": {
                    quantity: 2,
                    virtualization: {
                      memory_mib: 92136,
                      core_units: 200,
                    },
                  },
                },
              },
            },
          },
          available: {
            cpu: 48,
            memory: 192,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 2,
                product_groups: null,
                products: {
                  "NVIDIA-L20": {
                    quantity: 2,
                    virtualization: {
                      memory_mib: 8168,
                      core_units: 45,
                    },
                  },
                },
              },
            },
          },
          devices: [
            {
              uuid: "GPU-l20-low-memory",
              product: "NVIDIA-L20",
              health: true,
              allocatable: {
                memory_mib: 46068,
                core_units: 100,
              },
              available: {
                memory_mib: 1012,
                core_units: 30,
              },
            },
            {
              uuid: "GPU-l20-rounded-seven-gib",
              product: "NVIDIA-L20",
              health: true,
              allocatable: {
                memory_mib: 46068,
                core_units: 100,
              },
              available: {
                memory_mib: 7156,
                core_units: 15,
              },
            },
          ],
        },
      },
    },
  },
} satisfies EndpointClusterRef;

const roundedVramKubernetesClusterWithDevices = {
  metadata: metadata("virtualized-k8s-rounded-vram"),
  spec: {
    type: "kubernetes",
    accelerator_virtualization: { enabled: true },
  },
  status: {
    resource_info: {
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 1,
                virtualization: {
                  memory_mib: 46068,
                  core_units: 100,
                },
              },
            },
          },
        },
      },
      available: {
        cpu: 12,
        memory: 48,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 1,
                virtualization: {
                  memory_mib: 46068,
                  core_units: 100,
                },
              },
            },
          },
        },
      },
      node_resources: {
        "node-a": {
          allocatable: {
            cpu: 16,
            memory: 64,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 1,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 1,
                    virtualization: {
                      memory_mib: 46068,
                      core_units: 100,
                    },
                  },
                },
              },
            },
          },
          available: {
            cpu: 12,
            memory: 48,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 1,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 1,
                    virtualization: {
                      memory_mib: 46068,
                      core_units: 100,
                    },
                  },
                },
              },
            },
          },
          devices: [
            {
              uuid: "GPU-rounded-vram-1111-2222-3333-444444444444",
              product: "Tesla-T4",
              health: true,
              allocatable: {
                memory_mib: 46068,
                core_units: 100,
              },
              available: {
                memory_mib: 46068,
                core_units: 100,
              },
            },
          ],
        },
      },
    },
  },
} satisfies EndpointClusterRef;

const roundedVramLowRemainingClusterWithDevices = {
  ...roundedVramKubernetesClusterWithDevices,
  metadata: metadata("virtualized-k8s-rounded-vram-low-remaining"),
  status: {
    ...roundedVramKubernetesClusterWithDevices.status,
    resource_info: {
      ...roundedVramKubernetesClusterWithDevices.status.resource_info,
      available: {
        ...roundedVramKubernetesClusterWithDevices.status.resource_info
          .available,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 1,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 1,
                virtualization: {
                  memory_mib: 500,
                  core_units: 100,
                },
              },
            },
          },
        },
      },
      node_resources: {
        "node-a": {
          ...roundedVramKubernetesClusterWithDevices.status.resource_info
            .node_resources["node-a"],
          available: {
            ...roundedVramKubernetesClusterWithDevices.status.resource_info
              .node_resources["node-a"].available,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 1,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 1,
                    virtualization: {
                      memory_mib: 500,
                      core_units: 100,
                    },
                  },
                },
              },
            },
          },
          devices: [
            {
              ...roundedVramKubernetesClusterWithDevices.status.resource_info
                .node_resources["node-a"].devices[0],
              available: {
                memory_mib: 500,
                core_units: 100,
              },
            },
          ],
        },
      },
    },
  },
} satisfies EndpointClusterRef;

const defaultSelectResult = {
  query: { data: { data: [] }, isLoading: false },
};

function setupMocks(
  catalogs: Array<{
    id: number;
    metadata: { name: string };
    spec: Record<string, unknown>;
  }> = [catalogA, catalogB],
  clusters: EndpointClusterRef[] = [],
) {
  vi.mocked(useSelect).mockImplementation(((opts: { resource: string }) => {
    if (opts.resource === "model_catalogs") {
      return { query: { data: { data: catalogs }, isLoading: false } };
    }
    if (opts.resource === "clusters") {
      return { query: { data: { data: clusters }, isLoading: false } };
    }
    return defaultSelectResult;
  }) as unknown as typeof useSelect);

  vi.mocked(useRegistryModels).mockReturnValue({
    page: null,
    models: [],
    total: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRegistryModels>);
}

// --- Test components ---

let formInstance: ReturnType<typeof useEndpointForm>["form"] | null = null;

function CreateForm() {
  const result = useEndpointForm({ action: "create" });
  formInstance = result.form;
  return (
    <FormProvider {...result.form}>
      <form>
        {result.metadataFields}
        {result.templateFields}
        {result.resourceFields}
        {result.customizeFields}
      </form>
    </FormProvider>
  );
}

function EditForm() {
  const result = useEndpointForm({ action: "edit" });
  formInstance = result.form;
  return (
    <FormProvider {...result.form}>
      <form>
        {result.metadataFields}
        {result.templateFields}
        {result.resourceFields}
        {result.customizeFields}
      </form>
    </FormProvider>
  );
}

// --- Helpers ---

function selectCatalog(label: string) {
  const field = screen.getByTestId("field--model-catalog");
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("catalog combobox trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: label }));
}

function getAcceleratorCardText() {
  return screen.getByTestId("endpoint-resource-request-grid").textContent;
}

function getCurrentRequestText() {
  return screen.getByTestId("endpoint-current-request-grid").textContent;
}

function getCurrentRequestMetricText(label: string) {
  const grid = screen.getByTestId("endpoint-current-request-grid");
  const metricCard = Array.from(grid.children).find((child) =>
    child.textContent?.startsWith(label),
  );
  return metricCard?.textContent ?? "";
}

// --- Tests ---

describe("useEndpointForm", () => {
  beforeEach(() => {
    setupMocks();
    refineCoreOnFinishMock.mockReset();
    refineCoreOnFinishMock.mockResolvedValue(undefined);
    useFormOptionsRef.current = null;
    queryDataRef.current = null;
    formInstance = null;
  });

  it("locks the cluster when editing but keeps it selectable when creating", async () => {
    setupMocks([catalogA, catalogB], [virtualizedKubernetesClusterWithDevices]);
    const editRender = render(<EditForm />);

    const editClusterButton = await within(
      await screen.findByTestId("field-spec.cluster"),
    ).findByRole("combobox");
    expect(editClusterButton.hasAttribute("disabled")).toBe(true);

    editRender.unmount();
    render(<CreateForm />);

    const createClusterButton = await within(
      await screen.findByTestId("field-spec.cluster"),
    ).findByRole("combobox");
    expect(createClusterButton.hasAttribute("disabled")).toBe(false);
  });

  it("keeps an edit cluster visible when it is absent from cluster options", async () => {
    setupMocks([catalogA, catalogB], [virtualizedKubernetesClusterWithDevices]);
    render(<EditForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());
    act(() => {
      formInstance?.setValue("spec.cluster", "unlisted-existing-cluster");
    });

    const clusterButton = await within(
      screen.getByTestId("field-spec.cluster"),
    ).findByRole("combobox");
    expect(clusterButton.textContent).toContain("unlisted-existing-cluster");
  });

  it("places cluster-only scheduling target inside resource selection", async () => {
    setupMocks([catalogA, catalogB], [virtualizedKubernetesClusterWithDevices]);
    const { container } = render(<CreateForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());

    const text = container.textContent || "";
    const indexOf = (value: string) => {
      const index = text.indexOf(value);
      expect(index, `${value} should be rendered`).toBeGreaterThanOrEqual(0);
      return index;
    };

    const modelIndex = indexOf("endpoints.sections.modelAndReplicas");
    const engineIndex = indexOf("endpoints.sections.engineSettings");
    const resourceIndex = indexOf(
      "endpoints.sections.schedulingTargetResources",
    );
    const advancedIndex = indexOf("endpoints.sections.advancedOptions");

    expect(modelIndex).toBeLessThan(engineIndex);
    expect(engineIndex).toBeLessThan(resourceIndex);
    expect(resourceIndex).toBeLessThan(advancedIndex);
    expect(screen.queryByText("endpoints.sections.clusterSettings")).toBeNull();

    expect(indexOf("common.fields.cluster")).toBeGreaterThan(resourceIndex);
    expect(indexOf("common.fields.cluster")).toBeLessThan(advancedIndex);

    expect(indexOf("endpoints.fields.modelRegistry")).toBeGreaterThan(
      modelIndex,
    );
    expect(indexOf("endpoints.fields.modelName")).toBeGreaterThan(modelIndex);
    expect(indexOf("endpoints.fields.replicas")).toBeGreaterThan(modelIndex);
    expect(indexOf("endpoints.fields.replicas")).toBeLessThan(engineIndex);

    expect(indexOf("common.fields.engine")).toBeGreaterThan(engineIndex);
    expect(indexOf("common.fields.engine")).toBeLessThan(resourceIndex);

    expect(indexOf("common.fields.cpu")).toBeGreaterThan(resourceIndex);
    expect(indexOf("common.fields.cpu")).toBeLessThan(advancedIndex);

    const schedulingTarget = screen.getByTestId(
      "endpoint-scheduling-target-card",
    );
    const resourceConfigGrid = screen.getByTestId(
      "endpoint-resource-config-grid",
    );
    const layoutGrid = screen.getByTestId("endpoint-resource-layout-grid");
    expect(resourceConfigGrid.firstElementChild).toBe(schedulingTarget);
    expect(schedulingTarget.nextElementSibling).toBe(layoutGrid);

    expect(schedulingTarget.className).toContain("w-full");
    expect(schedulingTarget.className).not.toContain("sm:w-fit");
    expect(schedulingTarget.className).toContain("px-3");
    expect(schedulingTarget.className).toContain("py-2");
    expect(schedulingTarget.className).not.toContain("py-2.5");
    expect(schedulingTarget.firstElementChild?.className).toContain(
      "xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]",
    );
    expect(schedulingTarget.firstElementChild?.className).toContain(
      "xl:items-center",
    );
    expect(schedulingTarget.firstElementChild?.className).not.toContain(
      "xl:items-end",
    );
    expect(
      schedulingTarget.firstElementChild?.lastElementChild?.className,
    ).toContain("sm:grid-cols-[minmax(220px,280px)_max-content]");
    const clusterField =
      within(schedulingTarget).getByTestId("field-spec.cluster");
    expect(clusterField).toBeTruthy();
    expect(clusterField.className).toContain("max-w-[280px]");
    expect(
      within(schedulingTarget).queryByTestId("field--scheduling-scope"),
    ).toBeNull();
    expect(
      within(schedulingTarget).getByLabelText(
        "endpoints.descriptions.clusterSchedulingTarget",
      ),
    ).toBeTruthy();
    expect(
      within(schedulingTarget).queryByText(
        "endpoints.descriptions.clusterSchedulingTarget",
      ),
    ).toBeNull();
    const nodeCount = within(schedulingTarget).getByTestId(
      "endpoint-scheduling-target-node-count",
    );
    expect(
      clusterField.compareDocumentPosition(nodeCount) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(nodeCount.className).toContain("h-9");
    expect(nodeCount.className).not.toContain("flex-col");
    expect(nodeCount.textContent).toContain("-");
    expect(screen.queryByTestId("endpoint-resource-context")).toBeNull();
    expect(layoutGrid.className).toContain(
      "xl:grid-cols-[minmax(360px,420px)]",
    );

    act(() => {
      formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
    });
    await waitFor(() => expect(nodeCount.textContent).toContain("3"));
    await waitFor(() =>
      expect(screen.getByTestId("endpoint-resource-context")).toBeTruthy(),
    );
    expect(screen.getByTestId("endpoint-resource-context").parentElement).toBe(
      layoutGrid,
    );

    expect(indexOf("endpoints.fields.schedulerType")).toBeGreaterThan(
      advancedIndex,
    );
    expect(
      screen.queryByText("endpoints.sections.customizeSettings"),
    ).toBeNull();
    expect(
      screen.queryByText("endpoints.sections.configurationDetails"),
    ).toBeNull();
  });

  it("renders model catalog as a compact template row before model fields in create mode", async () => {
    setupMocks([catalogA, catalogB], [virtualizedKubernetesClusterWithDevices]);
    const { container } = render(<CreateForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());

    const text = container.textContent || "";
    const modelSectionIndex = text.indexOf(
      "endpoints.sections.modelAndReplicas",
    );
    const catalogIndex = text.indexOf("endpoints.fields.modelCatalog");
    const registryIndex = text.indexOf("endpoints.fields.modelRegistry");
    const modelIndex = text.indexOf("endpoints.fields.modelName");

    expect(modelSectionIndex).toBeGreaterThanOrEqual(0);
    expect(catalogIndex).toBeGreaterThan(modelSectionIndex);
    expect(catalogIndex).toBeLessThan(registryIndex);
    expect(registryIndex).toBeLessThan(modelIndex);
    expect(screen.getByTestId("model-catalog-row").className).toContain(
      "col-span-4",
    );
    // Catalog occupies the left half; Replicas sits beside it in the right half
    // of the same row (see use-endpoint-form templateFields).
    expect(screen.getByTestId("field--model-catalog").className).toContain(
      "col-span-2",
    );
  });

  it("renders resource inputs in the PRD order", async () => {
    setupMocks([catalogA, catalogB], [virtualizedKubernetesClusterWithDevices]);
    render(<CreateForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());

    act(() => {
      formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
      formInstance?.setValue("spec.resources.accelerator", {
        type: "nvidia_gpu",
        product: "Tesla-T4",
        virtualization: {
          memory_mib: 4096,
          core_percent: 50,
        },
      });
    });

    const requestGrid = await screen.findByTestId(
      "endpoint-resource-request-grid",
    );
    expect(requestGrid.className).toContain("grid-cols-1");
    const orderedFields = [
      within(requestGrid).getByTestId("field-spec.resources.cpu"),
      within(requestGrid).getByTestId("field-spec.resources.memory"),
      within(requestGrid).getByTestId("field-spec.resources.accelerator"),
      within(requestGrid).getByTestId("field-spec.resources.gpu"),
      within(requestGrid).getByTestId(
        "field-spec.resources.accelerator.virtualization.memory_mib",
      ),
      within(requestGrid).getByTestId(
        "field-spec.resources.accelerator.virtualization.core_percent",
      ),
    ];

    for (let index = 0; index < orderedFields.length - 1; index += 1) {
      expect(
        orderedFields[index].compareDocumentPosition(orderedFields[index + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(
      within(requestGrid).queryByTestId("field--gpu-allocation-mode"),
    ).toBeNull();
    expect(
      within(requestGrid).queryByTestId("field--vgpu-memory-mode"),
    ).toBeNull();
    expect(screen.queryByTestId("slider-input")).toBeNull();
  });

  it("does not render cluster capability in cluster settings", async () => {
    setupMocks([catalogA, catalogB], [virtualizedKubernetesClusterWithDevices]);
    render(<CreateForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());

    expect(screen.queryByText("endpoints.fields.clusterCapability")).toBeNull();
    expect(
      screen.queryByText("endpoints.messages.acceleratorVirtualizationEnabled"),
    ).toBeNull();
    expect(
      screen.queryByText(
        "endpoints.messages.acceleratorVirtualizationDisabled",
      ),
    ).toBeNull();
  });

  describe("create vs edit mode", () => {
    it("create mode shows model catalog selector", () => {
      render(<CreateForm />);
      expect(screen.getByTestId("field--model-catalog")).toBeTruthy();
    });

    it("edit mode hides model catalog selector", () => {
      render(<EditForm />);
      expect(screen.queryByTestId("field--model-catalog")).toBeNull();
    });

    it("create mode does not disable name input", () => {
      render(<CreateForm />);
      const input = screen
        .getByTestId("field-metadata.name")
        .querySelector("input");
      expect(input?.disabled).toBe(false);
    });

    it("edit mode disables name input", () => {
      render(<EditForm />);
      const input = screen
        .getByTestId("field-metadata.name")
        .querySelector("input");
      expect(input?.disabled).toBe(true);
    });
  });

  describe("vGPU fields", () => {
    it("syncs normalized resources from query data into the edit form", async () => {
      queryDataRef.current = {
        spec: {
          resources: {
            cpu: "2",
            memory: "8Gi",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "8192",
              "virtualization.core_percent": "50",
            },
          },
        },
      };

      render(<EditForm />);

      await waitFor(() => {
        expect(formInstance?.getValues("spec.resources")).toEqual({
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });
    });

    it("does not overwrite user-edited vGPU resources with stale query resources", async () => {
      queryDataRef.current = {
        spec: {
          resources: {
            cpu: "2",
            memory: "8Gi",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "8192",
              "virtualization.core_percent": "50",
            },
          },
        },
      };
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => {
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(8192);
      });

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
      });

      const input = await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "4" } });

      await waitFor(() => {
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(4096);
      });
      expect(
        screen.queryByText(/endpoints\.fields\.requestedVgpuMemory/),
      ).toBeNull();
    });

    it("normalizes backend query resources before editing an existing vGPU endpoint", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      const select = (
        useFormOptionsRef.current?.refineCoreProps as {
          queryOptions?: {
            select?: (response: Record<string, unknown>) => {
              data?: { spec?: { resources?: Record<string, unknown> | null } };
            };
          };
        }
      )?.queryOptions?.select;

      expect(select).toBeTypeOf("function");
      const selected = select?.({
        data: {
          metadata: metadata("virtualized-endpoint"),
          spec: {
            cluster: "virtualized-k8s",
            resources: {
              cpu: "2",
              memory: "8Gi",
              gpu: "1",
              accelerator: {
                type: "nvidia_gpu",
                product: "Tesla-T4",
                "virtualization.memory_mib": "8192",
                "virtualization.core_percent": "50",
              },
            },
          },
        },
      });

      expect(selected?.data?.spec?.resources).toEqual({
        cpu: 2,
        memory: 8,
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_mib: 8192,
            core_percent: 50,
          },
        },
      });
    });

    it("clears stale accelerator virtualization when the selected cluster is not vGPU-enabled", async () => {
      setupMocks([catalogA, catalogB], [plainKubernetesCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "plain-k8s");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_mib: 10240,
            core_percent: 30,
          },
        });
      });

      await waitFor(() => {
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toBeUndefined();
      });
    });

    it("updates single-card memory as backend MiB", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());
      expect(
        await screen.findByTestId("endpoint-resource-plan-card"),
      ).toBeTruthy();
      expect(screen.queryByTestId("endpoint-resource-context")).toBeNull();
      expect(
        screen.getByTestId("endpoint-resource-layout-grid").className,
      ).toContain("xl:grid-cols-[minmax(360px,420px)]");

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      const input = await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "4" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(4096);
      expect(
        screen.queryByText(/endpoints\.fields\.requestedVgpuMemory/),
      ).toBeNull();
    });

    it("displays rounded raw-max vGPU memory and accepts the displayed boundary", async () => {
      setupMocks(
        [catalogA, catalogB],
        [roundedVramKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-rounded-vram");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 46068,
              core_percent: 100,
            },
          },
        });
      });

      const input = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      expect(input.max).toBe("45");
      expect(input.value).toBe("45");

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "45" } });

      await waitFor(() => {
        expect(input.value).toBe("45");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(46068);
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("keeps values above the displayed vGPU memory max as over-limit", async () => {
      setupMocks(
        [catalogA, catalogB],
        [roundedVramKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-rounded-vram");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 100,
            },
          },
        });
      });

      const input = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "46" } });

      await waitFor(() => {
        expect(input.value).toBe("46");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(47104);
        expect(
          screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
        ).toBeTruthy();
      });
    });

    it("clamps values within the displayed vGPU memory max to raw capacity", async () => {
      setupMocks(
        [catalogA, catalogB],
        [roundedVramKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-rounded-vram");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 100,
            },
          },
        });
      });

      const input = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "44.99" } });

      await waitFor(() => {
        expect(input.value).toBe("45");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(46068);
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("clamps rounded vGPU memory input to the per-card placement boundary", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithFragmentedL20Memory],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-fragmented-l20-memory",
        );
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 0,
          accelerator: {
            type: "nvidia_gpu",
            product: "NVIDIA-L20",
          },
        });
      });

      const input = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      expect(input.max).toBe("7");

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "7" } });

      await waitFor(() => {
        expect(input.value).toBe("7");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(7156);
      });

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 1);
      });

      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("realigns displayed vGPU memory when card count changes after memory input", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithFragmentedL20Memory],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-fragmented-l20-memory",
        );
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 0,
          accelerator: {
            type: "nvidia_gpu",
            product: "NVIDIA-L20",
          },
        });
      });

      const input = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "1" } });

      await waitFor(() => {
        expect(input.value).toBe("1");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(1024);
      });

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 2);
      });

      await waitFor(() => {
        expect(input.value).toBe("1");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(1012);
        expect(getCurrentRequestText()).toContain("2.0 / 2.0");
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();

      act(() => {
        formInstance?.setValue("spec.replicas.num", 2);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("2.0 / 2.0");
        expect(input.max).toBe("1");
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();

      const cardCountInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.vgpuCount/i,
      }) as HTMLInputElement;
      expect(cardCountInput.max).toBe("2");

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 3);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("3.0 / 2.0");
      });
      expect(
        screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeTruthy();
    });

    it("uses the full edit request when reusing allocated vGPU devices", async () => {
      queryDataRef.current = {
        metadata: metadata("ruiyang-endpoint-0"),
        spec: {
          cluster: "virtualized-k8s-fragmented-l20-memory",
          resources: {
            cpu: "8",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "NVIDIA-L20",
              "virtualization.memory_mib": "22528",
              "virtualization.core_percent": "35",
            },
          },
          replicas: { num: 3 },
        },
        status: {
          resources: {
            replicas: [
              {
                instance_id: "ruiyang-endpoint-0-a",
                replica_id: "ruiyang-endpoint-0-a",
                node_id: "node-l20",
                devices: [
                  {
                    uuid: "GPU-l20-low-memory",
                    product: "NVIDIA-L20",
                    memory_mib: 22528,
                    core_units: 35,
                    node_id: "node-l20",
                  },
                ],
              },
              {
                instance_id: "ruiyang-endpoint-0-b",
                replica_id: "ruiyang-endpoint-0-b",
                node_id: "node-l20",
                devices: [
                  {
                    uuid: "GPU-l20-low-memory",
                    product: "NVIDIA-L20",
                    memory_mib: 22528,
                    core_units: 35,
                    node_id: "node-l20",
                  },
                ],
              },
              {
                instance_id: "ruiyang-endpoint-0-c",
                replica_id: "ruiyang-endpoint-0-c",
                node_id: "node-l20",
                devices: [
                  {
                    uuid: "GPU-l20-rounded-seven-gib",
                    product: "NVIDIA-L20",
                    memory_mib: 22528,
                    core_units: 35,
                    node_id: "node-l20",
                  },
                ],
              },
            ],
            summary: {
              products: {
                "NVIDIA-L20": {
                  memory_mib: 67584,
                  core_units: 105,
                },
              },
            },
          },
        },
      };
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithFragmentedL20Memory],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-fragmented-l20-memory",
        );
        formInstance?.setValue("spec.replicas.num", 3);
        formInstance?.setValue("spec.resources", {
          cpu: 8,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "NVIDIA-L20",
            virtualization: {
              memory_mib: 22528,
              core_percent: 35,
            },
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("2.0 / 2.0");
        expect(
          getCurrentRequestMetricText("endpoints.fields.vgpuMemoryCapacity"),
        ).toBe("endpoints.fields.vgpuMemoryCapacityGiB66.0 / 74.0");
        expect(
          getCurrentRequestMetricText("endpoints.fields.vgpuCoreCapacity"),
        ).toBe("endpoints.fields.vgpuCoreCapacity105.0 / 150.0");
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("clamps values within the displayed remaining vGPU memory max", async () => {
      setupMocks(
        [catalogA, catalogB],
        [roundedVramLowRemainingClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-rounded-vram-low-remaining",
        );
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 128,
              core_percent: 100,
            },
          },
        });
      });

      const input = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      expect(input.max).toBe("0.5");

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "0.5" } });

      await waitFor(() => {
        expect(input.value).toBe("0.5");
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(500);
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("ignores percent-backed virtual memory and edits it as MiB", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_percent: 50,
            core_percent: 0,
          },
        });
      });

      await waitFor(() => {
        expect(screen.queryByDisplayValue("7.5")).toBeNull();
      });

      const memoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
      expect((memoryInput as HTMLInputElement).value).toBe("");
      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "8" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_percent",
        ),
      ).toBeUndefined();
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(8192);
    });

    it("keeps core limit editable before single-card memory is configured", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        });
      });

      expect(
        screen.queryByText("endpoints.descriptions.vgpuCorePercentZero"),
      ).toBeNull();

      const coreInput = screen.getByRole("spinbutton", {
        name: "endpoints.fields.vgpuCoreLimit",
      }) as HTMLInputElement;
      expect(coreInput.disabled).toBe(false);
      fireEvent.focus(coreInput);
      fireEvent.change(coreInput, { target: { value: "25" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBe(25);

      const memoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "4" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(4096);
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBe(25);
    });

    it("does not write a default core limit when only VRAM is configured", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        });
      });

      const memoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "4" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(4096);
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBeUndefined();
    });

    it("keeps configured core limit when VRAM is cleared or set to zero", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_mib: 4096,
            core_percent: 25,
          },
        });
      });

      const memoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBeUndefined();
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBe(25);

      fireEvent.change(memoryInput, { target: { value: "0" } });

      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBeUndefined();
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBe(25);
    });

    it("renders configured core limit when editing a vGPU endpoint", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      const coreInput = (await screen.findByRole("spinbutton", {
        name: "endpoints.fields.vgpuCoreLimit",
      })) as HTMLInputElement;
      expect(coreInput.value).toBe("50");
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBe(50);
    });

    it("clears vGPU memory input without dropping configured core limit", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      const input = await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "0" } });

      await waitFor(() => {
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBeUndefined();
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.core_percent",
          ),
        ).toBe(50);
        expect(
          screen.queryByText("endpoints.messages.vgpuMemoryMiBPositive"),
        ).toBeNull();
      });
    });

    it("shows linked cluster and node GPU resources inline in the resource panel", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.replicas.num", 2);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 4096,
              core_percent: 0,
            },
          },
        });
      });

      expect(
        await screen.findByTestId("field-spec.resources.accelerator"),
      ).toBeTruthy();
      expect(screen.queryByText("endpoints.actions.openResources")).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("tab")).toBeNull();

      const panel = within(screen.getByTestId("endpoint-resource-context"));
      expect(panel.getByText("clusters.fields.gpuType")).toBeTruthy();
      expect(
        panel.queryByText("endpoints.messages.clusterSchedulingOnly"),
      ).toBeNull();
      expect(
        panel.getByTestId("endpoint-cluster-resource-summary"),
      ).toBeTruthy();
      expect(panel.getByTestId("endpoint-compact-node-resources")).toBeTruthy();
      const nodeCards = panel.getAllByTestId("endpoint-compact-node-card");
      expect(nodeCards.length).toBe(3);
      for (const nodeCard of nodeCards) {
        expect(nodeCard.className).toContain("rounded");
        expect(nodeCard.className).toContain("border");
        expect(nodeCard.className).toContain("bg-background");
      }
      for (const nodeName of panel.getAllByTestId(
        "endpoint-node-resource-name",
      )) {
        expect(nodeName.className).toContain("whitespace-normal");
        expect(nodeName.className).toContain("break-words");
        expect(nodeName.className).not.toContain("truncate");
      }
      expect(panel.getByText("node-c")).toBeTruthy();
      expect(nodeCards[0].textContent).toContain("node-a");
      expect(nodeCards[1].textContent).toContain("node-b");
      expect(nodeCards[2].textContent).toContain("node-c");
      const cpuOnlyNodeCard = nodeCards.find((nodeCard) =>
        nodeCard.textContent?.includes("node-c"),
      );
      expect(cpuOnlyNodeCard).toBeTruthy();
      expect(
        within(cpuOnlyNodeCard as HTMLElement).queryByText(
          "clusters.fields.memoryUsage",
        ),
      ).toBeNull();
      expect(
        within(cpuOnlyNodeCard as HTMLElement).queryByText(
          "clusters.fields.coreUsage",
        ),
      ).toBeNull();
      expect(
        within(cpuOnlyNodeCard as HTMLElement).queryByTestId(
          "endpoint-node-gpu-card-grid",
        ),
      ).toBeNull();
      expect(panel.queryByTestId("endpoint-resource-toolbar")).toBeNull();
      expect(panel.getAllByText("common.fields.cpu").length).toBeGreaterThan(0);
      expect(panel.getAllByText("common.fields.memory").length).toBeGreaterThan(
        0,
      );
      expect(panel.queryByText("endpoints.sections.currentRequest")).toBeNull();
      expect(panel.queryByRole("table")).toBeNull();
      expect(panel.queryByRole("combobox")).toBeNull();
      expect(panel.queryByText("clusters.options.summary")).toBeNull();
      expect(panel.queryByText("clusters.options.nodes")).toBeNull();
      expect(panel.queryByText("clusters.options.table")).toBeNull();
      expect(
        panel.getByTestId("endpoint-cluster-resource-toolbar"),
      ).toBeTruthy();
      expect(
        panel.getByTestId("endpoint-cluster-resource-target-notes").textContent,
      ).toContain("common.fields.cluster");
      expect(
        panel.getByTestId("endpoint-cluster-resource-target-notes").textContent,
      ).toContain("virtualized-k8s-devices");
      expect(
        panel.getByTestId("endpoint-cluster-resource-target-notes").textContent,
      ).not.toContain("endpoints.fields.nodeCount");
      expect(
        panel.getByTestId("endpoint-cluster-resource-board").className,
      ).toContain("min-w-[1120px]");
      const clusterSection = panel.getByTestId(
        "endpoint-cluster-resource-summary",
      );
      const nodeSection = panel.getByTestId("endpoint-compact-node-resources");
      expect(clusterSection.className).toContain("rounded");
      expect(clusterSection.className).toContain("border");
      expect(clusterSection.className).toContain("bg-muted/10");
      const clusterMetricsRow = within(clusterSection).getByTestId(
        "endpoint-cluster-resource-metrics",
      );
      expect(clusterMetricsRow.className).toContain(
        "grid-cols-[repeat(auto-fit,minmax(160px,1fr))]",
      );
      expect(clusterMetricsRow.className).not.toContain("rounded");
      expect(clusterMetricsRow.className).not.toContain("border");
      expect(clusterMetricsRow.className).not.toContain("bg-background");
      const clusterMetrics = within(clusterMetricsRow).getAllByTestId(
        "endpoint-resource-summary-card",
      );
      expect(clusterMetrics).toHaveLength(5);
      for (const metric of clusterMetrics) {
        expect(metric.className).toContain("rounded");
        expect(metric.className).toContain("border");
        expect(
          within(metric).getByTestId("endpoint-resource-summary-progress"),
        ).toBeTruthy();
        expect(
          within(metric).getByTestId("endpoint-resource-summary-percent")
            .className,
        ).toContain("text-muted-foreground");
        expect(
          within(metric).getByTestId("endpoint-resource-summary-free-value")
            .className,
        ).toContain("text-card-foreground");
        expect(
          within(metric).getByTestId("endpoint-resource-summary-free-value")
            .className,
        ).not.toContain("text-emerald");
      }
      for (const nodeMetrics of panel.getAllByTestId(
        "endpoint-node-resource-metrics",
      )) {
        expect(nodeMetrics.className).toContain("grid");
        expect(nodeMetrics.className).toContain(
          "grid-cols-[repeat(auto-fill,minmax(160px,200px))]",
        );
        expect(nodeMetrics.className).toContain("justify-start");
        expect(nodeMetrics.className).not.toContain("justify-end");
        expect(nodeMetrics.className).not.toContain("max-w");
        const pills = within(nodeMetrics).getAllByTestId(
          "endpoint-node-resource-pill",
        );
        expect(pills.length).toBeGreaterThan(0);
        for (const pill of pills) {
          expect(pill.className).not.toContain("w-[168px]");
          expect(pill.className).toContain("rounded");
          expect(pill.className).toContain("border");
          for (const value of within(pill).getAllByTestId(
            "endpoint-node-resource-pill-value",
          )) {
            expect(value.className).toContain("text-card-foreground");
            expect(value.className).not.toContain("text-emerald");
          }
        }
        expect(
          within(nodeMetrics).getAllByText("clusters.options.free").length,
        ).toBeGreaterThan(0);
      }
      for (const gpuGrid of panel.getAllByTestId(
        "endpoint-node-gpu-card-grid",
      )) {
        expect(gpuGrid.className).toContain(
          "grid-cols-[repeat(auto-fit,minmax(min(100%,180px),220px))]",
        );
        expect(gpuGrid.className).toContain("justify-start");
      }
      expect(
        panel
          .getAllByTestId("endpoint-gpu-device-card")
          .some(
            (card) =>
              card.className.includes(
                "border-[var(--nt-stroke-positive-light)]",
              ) && card.className.includes("bg-[var(--nt-fill-neutral-white)]"),
          ),
      ).toBe(true);
      expect(panel.getAllByTestId("endpoint-node-gpu-card-grid")).toHaveLength(
        2,
      );
      expect(
        panel.getAllByText((text) => text.includes("clusters.options.free"))
          .length,
      ).toBeGreaterThan(0);
      const orderedClusterMetrics = [
        within(clusterSection).getByText("endpoints.fields.physicalGpu"),
        within(clusterSection).getByText("clusters.fields.memoryUsage"),
        within(clusterSection).getByText("clusters.fields.coreUsage"),
        within(clusterSection).getByText("common.fields.cpu"),
        within(clusterSection).getByText("common.fields.memory"),
      ];
      for (
        let index = 0;
        index < orderedClusterMetrics.length - 1;
        index += 1
      ) {
        expect(
          orderedClusterMetrics[index].compareDocumentPosition(
            orderedClusterMetrics[index + 1],
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(
        clusterSection.compareDocumentPosition(nodeSection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getAllByText("Tesla-T4").length).toBeGreaterThan(0);
      expect(screen.queryByText("clusters.fields.vgpuMemoryUsage")).toBeNull();

      expect(
        within(clusterSection).getAllByText("cores").length,
      ).toBeGreaterThan(0);
      expect(within(clusterSection).getAllByText("GiB").length).toBeGreaterThan(
        0,
      );
      expect(
        within(clusterSection).queryByText((text) =>
          ["12.0 cores", "48.0 GiB", "15.0 GiB"].some((value) =>
            text.includes(value),
          ),
        ),
      ).toBeNull();
      for (const expectedFreeValue of ["12.0", "48.0", "15.0"]) {
        expect(
          within(clusterSection)
            .getAllByTestId("endpoint-resource-summary-free-value")
            .some((value) => value.textContent?.includes(expectedFreeValue)),
        ).toBe(true);
      }
      expect(
        within(clusterSection).getAllByText((text) =>
          text.includes("4.0 / 16.0"),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        within(clusterSection).getAllByText((text) =>
          text.includes("16.0 / 64.0"),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        within(clusterSection).getAllByText((text) =>
          text.includes("15.0 / 30.0"),
        ).length,
      ).toBeTruthy();
      expect(
        screen.getAllByText((text) => text.includes("15.0 / 30.0")).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText((text) => text.includes("50.0 / 200.0")).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText("7.5").length).toBeGreaterThan(0);
      expect(screen.getAllByText("15.0").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText((text) => text.includes("50.0")).length,
      ).toBeGreaterThan(0);
      expect(
        panel.getAllByText((text) => text.includes("clusters.options.usable"))
          .length,
      ).toBeGreaterThan(0);
      expect(
        panel.getAllByRole("img", {
          name: /clusters\.options\.(usable|healthy)/,
        }).length,
      ).toBeGreaterThan(0);
      expect(
        panel.getAllByRole("button", {
          name: /clusters\.fields\.gpuNumber 1.*clusters\.actions\.copyUuid/,
        }),
      ).toHaveLength(2);
      expect(
        panel.queryByRole("button", {
          name: /clusters\.fields\.gpuNumber 2.*clusters\.actions\.copyUuid/,
        }),
      ).toBeNull();

      const singleCardMemoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
      fireEvent.focus(singleCardMemoryInput);
      fireEvent.change(singleCardMemoryInput, { target: { value: "" } });

      await waitFor(() => {
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toBeUndefined();
        expect(
          screen.getByTestId(
            "field-spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBeTruthy();
        expect(getCurrentRequestText()).toContain("0.0 / 0.0");
        expect(getAcceleratorCardText()).toContain(
          "endpoints.messages.fullGpuResourcesInsufficient",
        );
      });
    });

    it("keeps low-usage GPU meter lines green when a healthy GPU is not allocatable", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 0,
            },
          },
        });
      });

      expect(
        await screen.findByTestId("field-spec.resources.accelerator"),
      ).toBeTruthy();

      const panel = within(screen.getByTestId("endpoint-resource-context"));
      const unavailableGpuCards = panel
        .getAllByTestId("endpoint-gpu-device-card")
        .filter((card) =>
          card.className.includes("border-[var(--nt-stroke-notice-light)]"),
        );

      expect(unavailableGpuCards.length).toBeGreaterThan(0);
      for (const progress of within(unavailableGpuCards[0]).getAllByTestId(
        "endpoint-gpu-resource-progress",
      )) {
        expect(progress.className).toContain(
          "bg-[var(--nt-fill-positive-light)]",
        );
        expect(progress.className).not.toContain(
          "bg-[var(--nt-fill-notice-light)]",
        );
      }
    });

    for (const scenario of [
      {
        cluster: plainKubernetesClusterWithNodeResources,
        clusterName: "plain-k8s-node-resources",
        label: "non-virtualized Kubernetes",
      },
      {
        cluster: staticNodeClusterWithNodeResources,
        clusterName: "static-node-resources",
        label: "static node",
      },
    ]) {
      it(`shows detailed GPU device resources for ${scenario.label} clusters`, async () => {
        setupMocks([catalogA, catalogB], [scenario.cluster]);
        render(<CreateForm />);

        await waitFor(() => expect(formInstance).not.toBeNull());

        act(() => {
          formInstance?.setValue("spec.cluster", scenario.clusterName);
          formInstance?.setValue("spec.resources", {
            cpu: 2,
            memory: 8,
            gpu: 1,
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
            },
          });
        });

        expect(
          await screen.findByTestId("field-spec.resources.accelerator"),
        ).toBeTruthy();

        const panel = within(screen.getByTestId("endpoint-resource-context"));
        const clusterSection = panel.getByTestId(
          "endpoint-cluster-resource-summary",
        );

        expect(clusterSection.className).toContain("rounded");
        expect(clusterSection.className).toContain("border");
        expect(clusterSection.className).toContain("bg-muted/10");
        const clusterMetricsRow = within(clusterSection).getByTestId(
          "endpoint-cluster-resource-metrics",
        );
        expect(clusterMetricsRow.className).toContain(
          "grid-cols-[repeat(auto-fit,minmax(160px,1fr))]",
        );
        expect(clusterMetricsRow.className).not.toContain("rounded");
        expect(clusterMetricsRow.className).not.toContain("border");
        expect(clusterMetricsRow.className).not.toContain("bg-background");
        expect(
          within(clusterMetricsRow).getAllByTestId(
            "endpoint-resource-summary-card",
          ).length,
        ).toBe(5);
        const orderedClusterMetrics = [
          within(clusterSection).getByText("endpoints.fields.physicalGpu"),
          within(clusterSection).getByText("clusters.fields.memoryUsage"),
          within(clusterSection).getByText("clusters.fields.coreUsage"),
          within(clusterSection).getByText("common.fields.cpu"),
          within(clusterSection).getByText("common.fields.memory"),
        ];
        for (
          let index = 0;
          index < orderedClusterMetrics.length - 1;
          index += 1
        ) {
          expect(
            orderedClusterMetrics[index].compareDocumentPosition(
              orderedClusterMetrics[index + 1],
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy();
        }

        expect(
          panel.getByTestId("endpoint-compact-node-resources"),
        ).toBeTruthy();
        const nodeCards = panel.getAllByTestId("endpoint-compact-node-card");
        expect(nodeCards).toHaveLength(2);
        for (const nodeCard of nodeCards) {
          expect(nodeCard.className).toContain("rounded");
          expect(nodeCard.className).toContain("border");
          expect(nodeCard.className).toContain("bg-background");
        }
        expect(
          panel.getAllByTestId("endpoint-node-gpu-card-grid"),
        ).toHaveLength(2);
        expect(
          panel.getAllByRole("button", {
            name: /clusters\.fields\.gpuNumber 1.*clusters\.actions\.copyUuid/,
          }),
        ).toHaveLength(2);
        expect(panel.queryByText("GPU-non-vgpu-free")).toBeNull();
        expect(panel.queryByText("GPU-non-vgpu-allocated")).toBeNull();
        expect(
          panel.getAllByText("clusters.fields.memoryUsage").length,
        ).toBeGreaterThan(0);
        expect(
          panel.getAllByText("clusters.fields.coreUsage").length,
        ).toBeGreaterThan(0);
        expect(panel.queryByText("clusters.messages.noGpuDevices")).toBeNull();
      });
    }

    it("hides GPU card count and GPU type for clusters without GPU resources", async () => {
      setupMocks([catalogA, catalogB], [cpuMemoryOnlyCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "cpu-memory-only");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 0,
          accelerator: null,
        });
      });

      const panel = within(screen.getByTestId("endpoint-resource-context"));
      const clusterSection = await panel.findByTestId(
        "endpoint-cluster-resource-summary",
      );

      expect(clusterSection.className).toContain("rounded");
      expect(clusterSection.className).toContain("border");
      expect(clusterSection.className).toContain("bg-muted/10");
      const clusterMetricsRow = within(clusterSection).getByTestId(
        "endpoint-cluster-resource-metrics",
      );
      expect(clusterMetricsRow.className).not.toContain("rounded");
      expect(clusterMetricsRow.className).not.toContain("border");
      expect(clusterMetricsRow.className).not.toContain("bg-background");
      expect(
        within(clusterMetricsRow).getAllByTestId(
          "endpoint-resource-summary-card",
        ).length,
      ).toBe(2);
      expect(panel.queryByText("clusters.fields.gpuType")).toBeNull();
      expect(
        within(clusterSection).queryByText("endpoints.fields.physicalGpu"),
      ).toBeNull();
      expect(
        within(clusterSection).getByText("common.fields.cpu"),
      ).toBeTruthy();
      expect(
        within(clusterSection).getByText("common.fields.memory"),
      ).toBeTruthy();
      expect(
        within(clusterSection).queryByText("clusters.fields.memoryUsage"),
      ).toBeNull();
      expect(
        within(clusterSection).queryByText("clusters.fields.coreUsage"),
      ).toBeNull();
      const clusterFreeValues = within(clusterSection).getAllByTestId(
        "endpoint-resource-summary-free-value",
      );
      expect(clusterFreeValues).toHaveLength(2);
      for (const freeValue of clusterFreeValues) {
        expect(freeValue.textContent).toContain("clusters.options.free");
      }

      expect(panel.getByTestId("endpoint-compact-node-resources")).toBeTruthy();
      for (const nodeCard of panel.getAllByTestId(
        "endpoint-compact-node-card",
      )) {
        expect(nodeCard.className).toContain("rounded");
        expect(nodeCard.className).toContain("border");
        expect(nodeCard.className).toContain("bg-background");
      }
      for (const nodeMetrics of panel.getAllByTestId(
        "endpoint-node-resource-metrics",
      )) {
        expect(nodeMetrics.className).toContain("grid");
        expect(nodeMetrics.className).toContain(
          "grid-cols-[repeat(auto-fill,minmax(160px,200px))]",
        );
        const pills = within(nodeMetrics).getAllByTestId(
          "endpoint-node-resource-pill",
        );
        expect(pills.length).toBe(2);
        for (const pill of pills) {
          expect(pill.className).not.toContain("w-[168px]");
          for (const value of within(pill).getAllByTestId(
            "endpoint-node-resource-pill-value",
          )) {
            expect(value.className).toContain("text-card-foreground");
            expect(value.className).not.toContain("text-emerald");
          }
        }
        expect(
          within(nodeMetrics).queryByText("endpoints.fields.physicalGpu"),
        ).toBeNull();
        expect(within(nodeMetrics).getByText("common.fields.cpu")).toBeTruthy();
        expect(
          within(nodeMetrics).getByText("common.fields.memory"),
        ).toBeTruthy();
        expect(
          within(nodeMetrics).getAllByText("clusters.options.free").length,
        ).toBe(2);
      }
      expect(panel.queryByTestId("endpoint-node-gpu-card-grid")).toBeNull();
      expect(panel.queryByText("clusters.messages.noGpuDevices")).toBeNull();
    });

    it("uses the productized resource configuration layout", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 2,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 4096,
              core_percent: 0,
            },
          },
        });
      });

      expect(
        await screen.findByTestId("endpoint-resource-plan-card"),
      ).toBeTruthy();
      expect(
        screen.getByRole("heading", {
          name: "endpoints.sections.resourcePlan",
        }),
      ).toBeTruthy();
      const acceleratorCard = screen.getByTestId(
        "endpoint-accelerator-resource-card",
      );
      expect(
        within(acceleratorCard).queryByTestId(
          "endpoint-accelerator-resource-metrics",
        ),
      ).toBeNull();
      const resourceContext = screen.getByTestId("endpoint-resource-context");
      const resourceContextPanel = within(resourceContext);
      expect(resourceContext.className).toContain("rounded-xl");
      expect(resourceContext.className).toContain("border");
      expect(resourceContext.className).not.toContain("p-3");
      expect(
        within(
          screen.getByTestId("endpoint-scheduling-target-card"),
        ).getByTestId("field-spec.cluster"),
      ).toBeTruthy();
      expect(resourceContextPanel.queryByRole("combobox")).toBeNull();
      expect(
        resourceContextPanel.getByTestId("endpoint-cluster-resource-toolbar"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getByTestId(
          "endpoint-cluster-resource-target-notes",
        ).textContent,
      ).not.toContain("endpoints.fields.nodeCount");
      expect(
        resourceContextPanel.getByTestId("endpoint-cluster-resource-board")
          .className,
      ).toContain("min-w-[1120px]");
      expect(
        resourceContextPanel.getByText("endpoints.fields.physicalGpu"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getByTestId("endpoint-cluster-resource-summary"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getAllByTestId("endpoint-resource-summary-card")
          .length,
      ).toBe(5);
      expect(
        resourceContextPanel.getAllByTestId(
          "endpoint-resource-summary-progress",
        ).length,
      ).toBe(5);
      expect(
        resourceContextPanel.getByTestId("endpoint-compact-node-resources"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getAllByTestId("endpoint-node-resource-pill")
          .length,
      ).toBeGreaterThan(0);
      expect(
        resourceContextPanel.getAllByText("clusters.fields.memoryUsage").length,
      ).toBeGreaterThan(0);
      expect(
        resourceContextPanel.getAllByText("clusters.fields.coreUsage").length,
      ).toBeGreaterThan(0);
      expect(
        resourceContextPanel.getAllByText("common.fields.cpu").length,
      ).toBeGreaterThan(0);
      expect(
        resourceContextPanel.getAllByText("common.fields.memory").length,
      ).toBeGreaterThan(0);
      expect(
        resourceContextPanel.queryByTestId(
          "endpoint-accelerator-resource-metrics",
        ),
      ).toBeNull();
      expect(screen.getByTestId("endpoint-resource-config-grid")).toBeTruthy();
      expect(
        screen.getByTestId("endpoint-resource-config-grid").className,
      ).toContain("space-y-4");
      expect(
        screen.getByTestId("endpoint-resource-layout-grid").className,
      ).toContain("xl:grid-cols-[minmax(360px,420px)_minmax(620px,1fr)]");
      expect(screen.getByTestId("endpoint-resource-config-main")).toBeTruthy();
      expect(resourceContext).toBeTruthy();
      expect(
        screen.getByText("endpoints.sections.currentRequest"),
      ).toBeTruthy();
      expect(
        screen.queryByTestId("endpoint-resource-summary-strip"),
      ).toBeNull();
      expect(
        within(screen.getByTestId("endpoint-resource-plan-header")).queryByText(
          "endpoints.fields.matchingGpuCards",
        ),
      ).toBeNull();
      expect(screen.getByTestId("endpoint-current-request-panel")).toBeTruthy();
      expect(
        screen.getByTestId("endpoint-current-request-grid").className,
      ).toContain("grid-cols-[repeat(auto-fit,minmax(110px,1fr))]");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("bg-emerald-50");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("text-emerald-700");
      expect(getAcceleratorCardText()).toContain(
        "endpoints.fields.virtualCardCount",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.fields.vgpuMemoryCapacity",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.fields.vgpuCoreCapacity",
      );
      expect(getAcceleratorCardText()).toContain("endpoints.fields.scheduling");
      expect(getAcceleratorCardText()).toContain("common.fields.cluster");
      expect(
        getCurrentRequestMetricText("endpoints.fields.vgpuCoreCapacity"),
      ).toBe("endpoints.fields.vgpuCoreCapacity-");
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.options.shared",
      );
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.descriptions.vgpuCorePercentZero",
      );
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.fields.schedulingScope",
      );
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.fields.matchingGpuCards",
      );
      expect(
        within(acceleratorCard).getByTestId(
          "endpoint-accelerator-allocator-row",
        ),
      ).toBeTruthy();
      const requestGrid = screen.getByTestId("endpoint-resource-request-grid");
      expect(requestGrid.className).toContain("grid-cols-1");
      expect(requestGrid.className).toContain("sm:grid-cols-2");
      const orderedFields = [
        within(requestGrid).getByTestId("field-spec.resources.cpu"),
        within(requestGrid).getByTestId("field-spec.resources.memory"),
        within(requestGrid).getByTestId("field-spec.resources.accelerator"),
        within(requestGrid).getByTestId("field-spec.resources.gpu"),
        within(requestGrid).getByTestId(
          "field-spec.resources.accelerator.virtualization.memory_mib",
        ),
        within(requestGrid).getByTestId(
          "field-spec.resources.accelerator.virtualization.core_percent",
        ),
      ];
      for (let index = 0; index < orderedFields.length - 1; index += 1) {
        expect(
          orderedFields[index].compareDocumentPosition(
            orderedFields[index + 1],
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(
        (within(orderedFields[0]).getByRole("spinbutton") as HTMLInputElement)
          .value,
      ).toBe("2");
      expect(
        (within(orderedFields[1]).getByRole("spinbutton") as HTMLInputElement)
          .value,
      ).toBe("8");
      expect(
        (within(orderedFields[3]).getByRole("spinbutton") as HTMLInputElement)
          .value,
      ).toBe("2");
      expect(
        (within(orderedFields[4]).getByRole("spinbutton") as HTMLInputElement)
          .value,
      ).toBe("4");
      expect(
        within(requestGrid).queryByTestId("field--gpu-allocation-mode"),
      ).toBeNull();
      expect(
        within(requestGrid).queryByTestId("field--vgpu-memory-mode"),
      ).toBeNull();
      expect(
        screen.getByTestId("field-spec.resources.gpu").className,
      ).toContain("col-span-1");
      expect(
        screen.getByTestId("field-spec.resources.accelerator").className,
      ).toContain("sm:col-span-2");
      expect(
        screen.getByTestId("endpoint-virtual-card-split-group").className,
      ).toContain("sm:col-span-2");
      expect(
        screen.getByTestId("endpoint-virtual-card-split-group").className,
      ).toContain("sm:grid-cols-2");
      expect(
        screen.getByTestId(
          "field-spec.resources.accelerator.virtualization.core_percent",
        ).className,
      ).toContain("col-span-1");
      expect(
        screen.getByTestId(
          "field-spec.resources.accelerator.virtualization.core_percent",
        ).className,
      ).not.toContain("opacity-80");
      expect(screen.queryByTestId("slider-input")).toBeNull();
    });

    it("shows single-replica vGPU card count over capacity in the edit resource form", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.replicas.num", 2);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 2,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 4096,
              core_percent: 100,
            },
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain(
          "endpoints.fields.virtualCardCount",
        );
      });
      expect(getCurrentRequestText()).toContain("2.0 / 1.0");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("bg-amber-50");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("text-amber-700");
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuResourcesInsufficient",
      );
      expect(
        within(screen.getByTestId("endpoint-resource-plan-header")).queryByText(
          "endpoints.messages.vgpuResourcesInsufficient",
        ),
      ).toBeNull();
    });

    it("falls back to aggregate vGPU pools when device details are unavailable", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithoutDeviceDetails],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-no-device-details",
        );
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("1.0 / 1.0");
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 2);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("2.0 / 1.0");
      });
      expect(
        screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeTruthy();
    });

    it("shows configured vGPU core request when available core is zero", async () => {
      const zeroCoreCluster = JSON.parse(
        JSON.stringify(virtualizedKubernetesClusterWithDevices),
      ) as EndpointClusterRef;
      zeroCoreCluster.metadata = metadata("virtualized-k8s-zero-core");
      const resourceInfo = zeroCoreCluster.status?.resource_info;
      const clusterProduct =
        resourceInfo?.available?.accelerator_groups?.nvidia_gpu?.products?.[
          "Tesla-T4"
        ];
      if (clusterProduct?.virtualization) {
        clusterProduct.virtualization.core_units = 0;
      }
      for (const node of Object.values(resourceInfo?.node_resources ?? {})) {
        for (const device of node.devices ?? []) {
          if (device.product === "Tesla-T4" && device.available) {
            device.available.core_units = 0;
          }
        }
      }

      setupMocks([catalogA, catalogB], [zeroCoreCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-zero-core");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 4096,
              core_percent: 50,
            },
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("50.0 / 0.0");
      });
      expect(getCurrentRequestText()).not.toContain("endpoints.options.shared");
    });

    it("shows full-card capacity warnings when requested cards exceed availability", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.replicas.num", 2);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => {
        expect(getAcceleratorCardText()).toContain(
          "endpoints.messages.fullGpuResourcesInsufficient",
        );
      });
      expect(
        getCurrentRequestMetricText("endpoints.fields.vgpuCoreCapacity"),
      ).toBe("endpoints.fields.vgpuCoreCapacity-");
      expect(
        within(screen.getByTestId("endpoint-resource-plan-header")).queryByText(
          "endpoints.messages.fullGpuResourcesInsufficient",
        ),
      ).toBeNull();
    });

    it("checks only additional full cards while editing an existing endpoint", async () => {
      queryDataRef.current = {
        metadata: metadata("accelerator-existing-full-gpu"),
        spec: {
          cluster: "virtualized-k8s-devices",
          replicas: { num: 1 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
            },
          },
        },
        status: null,
      };
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 2,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => {
        expect(getAcceleratorCardText()).toContain(
          "endpoints.messages.fullGpuResourcesInsufficient",
        );
      });
    });

    it("does not warn for unchanged full-card usage while editing", async () => {
      queryDataRef.current = {
        metadata: metadata("accelerator-existing-full-gpu"),
        spec: {
          cluster: "virtualized-k8s-devices",
          replicas: { num: 1 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
            },
          },
        },
        status: null,
      };
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("1.0 / 1.0");
      });
      expect(
        getCurrentRequestMetricText("endpoints.fields.vgpuCoreCapacity"),
      ).toBe("endpoints.fields.vgpuCoreCapacity-");
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("does not double-count an edit endpoint full-card allocation when the card is already available", async () => {
      const singleCardCluster = {
        metadata: metadata("single-card-edit"),
        spec: {
          type: "kubernetes",
          accelerator_virtualization: { enabled: true },
        },
        status: {
          resource_info: {
            allocatable: {
              cpu: 16,
              memory: 64,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: null,
                  products: {
                    "Tesla-T4": { quantity: 1 },
                  },
                },
              },
            },
            available: {
              cpu: 12,
              memory: 48,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: null,
                  products: {
                    "Tesla-T4": { quantity: 1 },
                  },
                },
              },
            },
            node_resources: {
              "node-a": {
                allocatable: {
                  cpu: 16,
                  memory: 64,
                  accelerator_groups: {
                    nvidia_gpu: {
                      quantity: 1,
                      product_groups: null,
                      products: {
                        "Tesla-T4": { quantity: 1 },
                      },
                    },
                  },
                },
                available: {
                  cpu: 12,
                  memory: 48,
                  accelerator_groups: {
                    nvidia_gpu: {
                      quantity: 1,
                      product_groups: null,
                      products: {
                        "Tesla-T4": { quantity: 1 },
                      },
                    },
                  },
                },
                devices: [
                  {
                    uuid: "GPU-single-current",
                    product: "Tesla-T4",
                    health: true,
                    allocatable: { memory_mib: 15360, core_units: 100 },
                    available: { memory_mib: 15360, core_units: 100 },
                  },
                ],
              },
            },
          },
        },
      } satisfies EndpointClusterRef;
      queryDataRef.current = {
        metadata: metadata("single-card-existing-full"),
        spec: {
          cluster: "single-card-edit",
          replicas: { num: 1 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
            },
          },
        },
        status: {
          resources: {
            replicas: [
              {
                instance_id: "single-card-existing-full-0",
                replica_id: "single-card-existing-full-0",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-single-current",
                    product: "Tesla-T4",
                    memory_mib: 15360,
                    core_units: 100,
                    node_id: "node-a",
                  },
                ],
              },
            ],
          },
        },
      };
      setupMocks([catalogA, catalogB], [singleCardCluster]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "single-card-edit");
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("1.0 / 1.0");
      });
      expect(getCurrentRequestText()).not.toContain("1.0 / 2.0");
    });

    it("shows current request VRAM and core as dashes for fractional full-card static cluster allocation", async () => {
      setupMocks([catalogA, catalogB], [staticNodeClusterWithNodeResources]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "static-node-resources");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 0.5,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("0.5 / 1.0");
      });
      expect(
        getCurrentRequestMetricText("endpoints.fields.vgpuMemoryCapacity"),
      ).toBe("endpoints.fields.vgpuMemoryCapacity-");
      expect(
        getCurrentRequestMetricText("endpoints.fields.vgpuMemoryCapacity"),
      ).not.toContain("GiB");
      expect(
        getCurrentRequestMetricText("endpoints.fields.vgpuCoreCapacity"),
      ).toBe("endpoints.fields.vgpuCoreCapacity-");
    });

    it("blocks fractional GPU replicas that exceed per-device placement slots", async () => {
      const fractionalPlacementCluster = {
        metadata: metadata("fractional-placement"),
        spec: { type: "kubernetes" },
        status: {
          resource_info: {
            allocatable: {
              cpu: 16,
              memory: 64,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 2,
                  product_groups: null,
                  products: {
                    "Tesla-T4": { quantity: 2 },
                  },
                },
              },
            },
            available: {
              cpu: 12,
              memory: 48,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 2,
                  product_groups: null,
                  products: {
                    "Tesla-T4": { quantity: 2 },
                  },
                },
              },
            },
            node_resources: {
              "node-a": {
                allocatable: null,
                available: null,
                devices: [
                  {
                    uuid: "GPU-fractional-a",
                    product: "Tesla-T4",
                    health: true,
                    allocatable: { memory_mib: 15360, core_units: 100 },
                    available: { memory_mib: 9216, core_units: 60 },
                  },
                  {
                    uuid: "GPU-fractional-b",
                    product: "Tesla-T4",
                    health: true,
                    allocatable: { memory_mib: 15360, core_units: 100 },
                    available: { memory_mib: 9216, core_units: 60 },
                  },
                ],
              },
            },
          },
        },
      } satisfies EndpointClusterRef;

      setupMocks([catalogA, catalogB], [fractionalPlacementCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "fractional-placement");
        formInstance?.setValue("spec.replicas.num", 3);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 0.5,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("1.5 / 2.0");
        expect(getAcceleratorCardText()).toContain(
          "endpoints.messages.fullGpuResourcesInsufficient",
        );
      });
    });

    it("adds the current endpoint vGPU allocation back while editing", async () => {
      queryDataRef.current = {
        metadata: metadata("virtualized-existing-vgpu"),
        spec: {
          cluster: "virtualized-k8s-devices",
          replicas: { num: 1 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "8192",
              "virtualization.core_percent": "50",
            },
          },
        },
        status: {
          resources: {
            replicas: [
              {
                instance_id: "virtualized-existing-vgpu-abc",
                replica_id: "virtualized-existing-vgpu-abc",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-11111111-2222-3333-4444-555555555555",
                    product: "Tesla-T4",
                    memory_mib: 8192,
                    core_units: 50,
                    node_id: "node-a",
                  },
                ],
              },
            ],
            summary: {
              products: {
                "Tesla-T4": {
                  memory_mib: 8192,
                  core_units: 50,
                },
              },
            },
          },
        },
      };
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.replicas.num", 1);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain(
          "endpoints.fields.virtualCardCount",
        );
      });
      expect(getCurrentRequestText()).toContain("1.0 / 1.0");
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("reuses summary-only vGPU allocation when editing without device resources", async () => {
      queryDataRef.current = {
        metadata: metadata("summary-only-existing-vgpu"),
        spec: {
          cluster: "virtualized-k8s-no-device-details",
          replicas: { num: 1 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "8192",
              "virtualization.core_percent": "50",
            },
          },
        },
        status: {
          resources: {
            summary: {
              products: {
                "Tesla-T4": {
                  memory_mib: 8192,
                  core_units: 50,
                },
              },
            },
          },
        },
      };
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithoutDeviceDetails],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-no-device-details",
        );
        formInstance?.setValue("spec.resources.gpu", 2);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("2.0 / 2.0");
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 3);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("3.0 / 2.0");
      });
      expect(
        screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeTruthy();
    });

    it("does not double-count an edit endpoint vGPU allocation when the card is already available", async () => {
      const singleCardCluster = {
        metadata: metadata("single-card-vgpu-edit"),
        spec: {
          type: "kubernetes",
          accelerator_virtualization: { enabled: true },
        },
        status: {
          resource_info: {
            allocatable: {
              cpu: 16,
              memory: 64,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: null,
                  products: {
                    "Tesla-T4": {
                      quantity: 1,
                      virtualization: {
                        memory_mib: 15360,
                        core_units: 100,
                      },
                    },
                  },
                },
              },
            },
            available: {
              cpu: 12,
              memory: 48,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: null,
                  products: {
                    "Tesla-T4": {
                      quantity: 1,
                      virtualization: {
                        memory_mib: 15360,
                        core_units: 100,
                      },
                    },
                  },
                },
              },
            },
            node_resources: {
              "node-a": {
                allocatable: {
                  cpu: 16,
                  memory: 64,
                  accelerator_groups: {
                    nvidia_gpu: {
                      quantity: 1,
                      product_groups: null,
                      products: {
                        "Tesla-T4": {
                          quantity: 1,
                          virtualization: {
                            memory_mib: 15360,
                            core_units: 100,
                          },
                        },
                      },
                    },
                  },
                },
                available: {
                  cpu: 12,
                  memory: 48,
                  accelerator_groups: {
                    nvidia_gpu: {
                      quantity: 1,
                      product_groups: null,
                      products: {
                        "Tesla-T4": {
                          quantity: 1,
                          virtualization: {
                            memory_mib: 15360,
                            core_units: 100,
                          },
                        },
                      },
                    },
                  },
                },
                devices: [
                  {
                    uuid: "GPU-single-vgpu-current",
                    product: "Tesla-T4",
                    health: true,
                    allocatable: { memory_mib: 15360, core_units: 100 },
                    available: { memory_mib: 15360, core_units: 100 },
                  },
                ],
              },
            },
          },
        },
      } satisfies EndpointClusterRef;
      queryDataRef.current = {
        metadata: metadata("single-card-existing-vgpu"),
        spec: {
          cluster: "single-card-vgpu-edit",
          replicas: { num: 1 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "8192",
              "virtualization.core_percent": "50",
            },
          },
        },
        status: {
          resources: {
            replicas: [
              {
                instance_id: "single-card-existing-vgpu-0",
                replica_id: "single-card-existing-vgpu-0",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-single-vgpu-current",
                    product: "Tesla-T4",
                    memory_mib: 8192,
                    core_units: 50,
                    node_id: "node-a",
                  },
                ],
              },
            ],
            summary: {
              products: {
                "Tesla-T4": {
                  memory_mib: 8192,
                  core_units: 50,
                },
              },
            },
          },
        },
      };
      setupMocks([catalogA, catalogB], [singleCardCluster]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "single-card-vgpu-edit");
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain(
          "endpoints.fields.virtualCardCount",
        );
      });
      expect(getCurrentRequestText()).toContain("1.0 / 1.0");
      expect(getCurrentRequestText()).not.toContain("1.0 / 2.0");
    });

    it("switches allocation mode by clearing or setting single-card memory", async () => {
      setupMocks([catalogA, catalogB], [virtualizedKubernetesCluster]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain(
          "endpoints.fields.virtualCardCount",
        );
      });
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(8192);

      const memoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "" } });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("0.0 / 0.0");
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toEqual({ core_percent: 50 });
      });

      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "8" } });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain(
          "endpoints.fields.virtualCardCount",
        );
      });
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(8192);
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.core_percent",
        ),
      ).toBe(50);
    });

    it("disables the core limit input when the cluster mode does not support core virtualization", async () => {
      setupMocks(
        [catalogA, catalogB],
        [templateModeVirtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "template-mode-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      const coreInput = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.vgpuCoreLimit/i,
      })) as HTMLInputElement;
      const memoryInput = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      expect(coreInput.disabled).toBe(true);
      expect(memoryInput.disabled).toBe(false);
    });

    it("keeps both split inputs enabled when the cluster mode supports core virtualization", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      const coreInput = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.vgpuCoreLimit/i,
      })) as HTMLInputElement;
      const memoryInput = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      expect(coreInput.disabled).toBe(false);
      expect(memoryInput.disabled).toBe(false);
    });

    it("keeps both split inputs enabled when the cluster reports no virtualization mode", async () => {
      setupMocks(
        [catalogA, catalogB],
        [virtualizedKubernetesClusterWithoutDeviceDetails],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue(
          "spec.cluster",
          "virtualized-k8s-no-device-details",
        );
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      const coreInput = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.vgpuCoreLimit/i,
      })) as HTMLInputElement;
      const memoryInput = (await screen.findByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      })) as HTMLInputElement;

      expect(coreInput.disabled).toBe(false);
      expect(memoryInput.disabled).toBe(false);
    });

    it("clears the core limit value when the cluster mode stops supporting it", async () => {
      setupMocks(
        [catalogA, catalogB],
        [
          virtualizedKubernetesClusterWithDevices,
          templateModeVirtualizedKubernetesClusterWithDevices,
        ],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      // On the core-supporting cluster both split values are present.
      expect(
        formInstance?.getValues("spec.resources.accelerator.virtualization"),
      ).toEqual({ memory_mib: 8192, core_percent: 50 });

      act(() => {
        formInstance?.setValue("spec.cluster", "template-mode-k8s-devices");
      });

      await waitFor(() => {
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toEqual({ memory_mib: 8192 });
      });
    });

    it("clears an unsupported core limit on load in edit mode", async () => {
      queryDataRef.current = {
        spec: {
          cluster: "template-mode-k8s-devices",
          resources: {
            cpu: "2",
            memory: "8Gi",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "8192",
              "virtualization.core_percent": "50",
            },
          },
        },
      };
      setupMocks(
        [catalogA, catalogB],
        [templateModeVirtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "template-mode-k8s-devices");
      });

      await waitFor(() => {
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toEqual({ memory_mib: 8192 });
      });
    });
  });

  describe("submit transform", () => {
    it("submits backend-compatible flat vGPU resource keys", async () => {
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("metadata.name", "virtualized-endpoint");
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: {
              memory_mib: 8192,
              core_percent: 50,
            },
          },
        });
      });

      await act(async () => {
        await formInstance?.refineCore.onFinish(formInstance.getValues());
      });

      const submitted = refineCoreOnFinishMock.mock.calls[0]?.[0];
      expect(submitted?.spec.resources).toEqual({
        cpu: "2",
        memory: "8",
        gpu: "1",
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          "virtualization.memory_mib": "8192",
          "virtualization.core_percent": "50",
        },
      });
      expect(submitted?.spec.resources.accelerator.virtualization).toBe(
        undefined,
      );
    });

    it("submits JSON object engine_args as structured values", async () => {
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("metadata.name", "json-engine-args-endpoint");
        formInstance?.setValue("spec.variables.engine_args", {
          speculative_config: '{"method":"mtp","nested":{"enabled":true}}',
          max_model_len: "4096",
        });
      });

      await act(async () => {
        await formInstance?.refineCore.onFinish(formInstance.getValues());
      });

      const submitted = refineCoreOnFinishMock.mock.calls[0]?.[0];
      expect(submitted?.spec.variables.engine_args).toEqual({
        speculative_config: {
          method: "mtp",
          nested: { enabled: true },
        },
        max_model_len: "4096",
      });
    });
  });

  describe("handleModelCatalogSelect", () => {
    it("applies catalog values to form fields", async () => {
      render(<CreateForm />);

      selectCatalog("vllm-llama");

      await waitFor(() => {
        expect(formInstance).not.toBeNull();
        const values = formInstance?.getValues();
        expect(values?.spec.model.name).toBe("llama-3");
        expect(values?.spec.model.version).toBe("1.0");
        expect(values?.spec.model.registry).toBe("hf");
        expect(values?.spec.model.file).toBe("model.bin");
        expect(values?.spec.engine.engine).toBe("vllm");
        expect(values?.spec.engine.version).toBe("0.6.0");
        expect(values?.spec.resources.cpu).toBe("4");
        expect(values?.spec.resources.memory).toBe("8");
        expect(values?.spec.replicas.num).toBe(2);
        expect(values?.spec.deployment_options.scheduler.type).toBe(
          "roundrobin",
        );
      });
    });

    it("resets to defaults when switching to catalog with null fields", async () => {
      render(<CreateForm />);

      // Select catalog A first (has resources, replicas, variables)
      selectCatalog("vllm-llama");
      await waitFor(() => {
        expect(formInstance?.getValues("spec.resources.cpu")).toBe("4");
        expect(formInstance?.getValues("spec.replicas.num")).toBe(2);
      });

      // Switch to catalog B (null resources, replicas, variables)
      selectCatalog("llama-cpp-basic");
      await waitFor(() => {
        expect(formInstance).not.toBeNull();
        const values = formInstance?.getValues();
        // Resources should be reset to defaults
        expect(values?.spec.resources.cpu).toBe("0");
        expect(values?.spec.resources.memory).toBe("0");
        expect(values?.spec.resources.gpu).toBe("0");
        // Replicas should be reset to default
        expect(values?.spec.replicas.num).toBe(1);
        // Model and engine should reflect catalog B
        expect(values?.spec.model.name).toBe("tiny-model");
        expect(values?.spec.engine.engine).toBe("llama-cpp");
      });
    });

    it("resets all fields to defaults when selecting None", async () => {
      render(<CreateForm />);

      // Select catalog A first
      selectCatalog("vllm-llama");
      await waitFor(() => {
        expect(formInstance?.getValues("spec.model.name")).toBe("llama-3");
        expect(formInstance?.getValues("spec.model.file")).toBe("model.bin");
        expect(formInstance?.getValues("spec.engine.engine")).toBe("vllm");
        expect(formInstance?.getValues("spec.resources.cpu")).toBe("4");
        expect(formInstance?.getValues("spec.replicas.num")).toBe(2);
      });

      // Select "None" to clear catalog
      selectCatalog("common.options.none");
      await waitFor(() => {
        const values = formInstance?.getValues();
        // All catalog-managed fields should be reset to defaults
        expect(values?.spec.model.name).toBe("");
        expect(values?.spec.model.file).toBe("");
        expect(values?.spec.model.registry).toBe("");
        expect(values?.spec.engine.engine).toBe("");
        expect(values?.spec.engine.version).toBe("");
        expect(values?.spec.resources.cpu).toBe("0");
        expect(values?.spec.resources.memory).toBe("0");
        expect(values?.spec.replicas.num).toBe(1);
        expect(values?.spec.deployment_options.scheduler.type).toBe(
          "consistent_hash",
        );
      });
    });

    it("allows selecting a new catalog after clearing with None", async () => {
      render(<CreateForm />);

      // Select catalog A
      selectCatalog("vllm-llama");
      await waitFor(() => {
        expect(formInstance?.getValues("spec.model.name")).toBe("llama-3");
      });

      // Clear with None
      selectCatalog("common.options.none");
      await waitFor(() => {
        expect(formInstance?.getValues("spec.model.name")).toBe("");
      });

      // Select catalog B
      selectCatalog("llama-cpp-basic");
      await waitFor(() => {
        expect(formInstance?.getValues("spec.model.name")).toBe("tiny-model");
        expect(formInstance?.getValues("spec.engine.engine")).toBe("llama-cpp");
      });
    });
  });

  describe("scheduler type validation", () => {
    it("defaults scheduler type to consistent_hash", () => {
      render(<CreateForm />);
      expect(
        formInstance?.getValues("spec.deployment_options.scheduler.type"),
      ).toBe("consistent_hash");
    });

    it("blocks validation when scheduler type is cleared", async () => {
      render(<CreateForm />);

      let valid: boolean | undefined;
      await act(async () => {
        formInstance?.setValue("spec.deployment_options.scheduler.type", "");
        valid = await formInstance?.trigger();
      });
      expect(valid).toBe(false);

      const error =
        formInstance?.formState.errors?.[
          "spec.deployment_options.scheduler.type"
        ];
      expect(error?.message).toBe("endpoints.messages.schedulerTypeRequired");
    });
  });

  describe("workspace validation (resolver)", () => {
    beforeEach(() => {
      setupMocks();
      mockUseWorkspace.mockReset();
    });

    it("shows validation error when workspace is _all_ (resolver path)", async () => {
      mockUseWorkspace.mockReturnValue({ current: "_all_" });

      render(<CreateForm />);

      await act(async () => {
        await formInstance!.trigger("metadata.workspace");
      });

      expect(
        screen.getByText("common.validation.workspaceRequired"),
      ).toBeTruthy();
    });

    it("does not show error when workspace is valid (resolver path)", async () => {
      mockUseWorkspace.mockReturnValue({ current: "ws-alpha" });

      render(<CreateForm />);

      await act(async () => {
        await formInstance!.trigger("metadata.workspace");
      });

      expect(
        screen.queryByText("common.validation.workspaceRequired"),
      ).toBeNull();
    });
  });

  // Simplified recipe deploy hides advanced controls, but on a vGPU-enabled
  // cluster the virtual-card split (and its capacity feedback) is a deploy
  // essential — a partially used card can make full-card allocation
  // impossible, so these must not sit behind "Show all options".
  describe("simplified recipe deploy on vGPU clusters", () => {
    it("keeps the vGPU split group and current-request panel visible without expanding all options", async () => {
      setupMocks(
        [catalogA, recipeCatalog],
        [virtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      selectCatalog("recipe-mc");
      await act(async () => {
        formInstance?.setValue("spec.cluster", "virtualized-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        });
      });

      // Simplified mode is active: advanced model fields stay hidden...
      expect(screen.queryByTestId("field-spec.model.version")).toBeNull();
      // ...but the vGPU split controls and capacity feedback are visible.
      expect(
        screen.getByTestId("endpoint-virtual-card-split-group"),
      ).toBeTruthy();
      expect(screen.getByTestId("endpoint-current-request-panel")).toBeTruthy();
    });

    it("keeps the vGPU split group hidden in simplified mode on non-vGPU clusters", async () => {
      setupMocks(
        [catalogA, recipeCatalog],
        [plainKubernetesClusterWithNodeResources],
      );
      render(<CreateForm />);

      selectCatalog("recipe-mc");
      await act(async () => {
        formInstance?.setValue("spec.cluster", "plain-k8s-node-resources");
      });

      expect(
        screen.queryByTestId("endpoint-virtual-card-split-group"),
      ).toBeNull();
    });
  });

  // NEU-590: the hardware-verified list is advice, not a gate. When none of
  // the recipe's validated GPUs exist in the cluster, the accelerator picker
  // must stay visible and fall back to every available accelerator, with a
  // notice — not disappear behind "Show all options".
  describe("unverified accelerator fallback (NEU-590)", () => {
    const recipeCatalogVerified = (verified: string) => ({
      ...recipeCatalog,
      metadata: {
        name: "recipe-mc",
        annotations: { "recipe.vllm.ai/hardware-verified": verified },
      },
      spec: {
        ...recipeCatalog.spec,
        variants: {
          default: {
            ...recipeCatalog.spec.variants.default,
            vram_minimum_gb: 4,
          },
        },
      },
    });

    async function renderWithVerified(verified: string) {
      setupMocks(
        [catalogA, recipeCatalogVerified(verified)],
        [plainKubernetesClusterWithNodeResources],
      );
      render(<CreateForm />);
      selectCatalog("recipe-mc");
      await act(async () => {
        formInstance?.setValue("spec.cluster", "plain-k8s-node-resources");
      });
    }

    it("keeps the picker usable with all cluster accelerators when the verified list is disjoint", async () => {
      await renderWithVerified("H100");

      // The picker is still rendered (not replaced by a notice-only block)...
      const field = screen.getByTestId("field-spec.resources.accelerator");
      const trigger = field.querySelector('button[role="combobox"]');
      expect(trigger).toBeTruthy();
      // ...and enabled, which proves the fallback options are non-empty (the
      // combobox is disabled whenever displayedAcceleratorOptions is empty).
      expect((trigger as HTMLButtonElement).disabled).toBe(false);
      // The unvalidated-hardware notice is shown alongside it.
      expect(
        screen.getByTestId("endpoint-accelerator-unverified-notice"),
      ).toBeTruthy();
    });

    it("shows no notice on a cluster without accelerators", async () => {
      setupMocks(
        [catalogA, recipeCatalogVerified("H100")],
        [plainKubernetesCluster],
      );
      render(<CreateForm />);
      selectCatalog("recipe-mc");
      await act(async () => {
        formInstance?.setValue("spec.cluster", "plain-k8s");
      });

      // A GPU-less cluster is not a "disjoint verified list" — the notice
      // must not claim to be showing alternative accelerators.
      expect(
        screen.queryByTestId("endpoint-accelerator-unverified-notice"),
      ).toBeNull();
    });

    it("shows no notice and keeps the verified-only options when the lists intersect", async () => {
      await renderWithVerified("T4");

      const field = screen.getByTestId("field-spec.resources.accelerator");
      const trigger = field.querySelector('button[role="combobox"]');
      expect(trigger).toBeTruthy();
      expect((trigger as HTMLButtonElement).disabled).toBe(false);
      expect(
        screen.queryByTestId("endpoint-accelerator-unverified-notice"),
      ).toBeNull();
    });
  });

  // NEU-503: the model-exists check must be driven by an exact-name lookup,
  // not by whatever page the dropdown's search last fetched.
  describe("model existence validation (NEU-503)", () => {
    // The hook issues two registry-models queries: the dropdown list (keyed by
    // modelSearch) and the exact-name existence lookup. Route by search term so
    // the dropdown list stays empty while the existence lookup is controlled.
    // A null page is "no answer yet", which is what the resolver must not read
    // as "the model does not exist".
    function mockModelQueries(existenceModels: { name: string }[] | null) {
      vi.mocked(useRegistryModels).mockImplementation(((opts: {
        search?: string;
      }) => {
        const page =
          opts.search === "llama-3" && existenceModels
            ? { models: existenceModels, total: existenceModels.length }
            : null;

        return {
          page,
          models: page?.models ?? [],
          total: page?.total ?? null,
          isLoading: false,
          isFetching: false,
          error: null,
          refetch: vi.fn(),
        };
      }) as unknown as typeof useRegistryModels);
    }

    it("surfaces model-not-found when the exact-name lookup has no match", async () => {
      mockModelQueries([{ name: "some-other-model" }]);
      render(<CreateForm />);

      selectCatalog("vllm-llama");

      // The re-validation effect fires on lookup data, without any further
      // user interaction.
      await waitFor(() => {
        expect(
          screen.getByText("endpoints.messages.modelNotFoundInRegistry"),
        ).toBeTruthy();
      });
    });

    it("accepts a model returned by the exact-name lookup even when the dropdown list misses it", async () => {
      mockModelQueries([{ name: "llama-3" }]);
      render(<CreateForm />);

      selectCatalog("vllm-llama");

      await act(async () => {
        await formInstance?.trigger();
      });
      expect(
        screen.queryByText("endpoints.messages.modelNotFoundInRegistry"),
      ).toBeNull();
    });

    it("does not block while the existence lookup is unresolved", async () => {
      mockModelQueries(null);
      render(<CreateForm />);

      selectCatalog("vllm-llama");

      await act(async () => {
        await formInstance?.trigger();
      });
      expect(
        screen.queryByText("endpoints.messages.modelNotFoundInRegistry"),
      ).toBeNull();
    });
  });
});
