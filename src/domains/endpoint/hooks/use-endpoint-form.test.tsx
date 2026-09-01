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

// Picking a model reads that version's detail for its static parameters.
vi.mock("@/foundation/hooks/use-registry-model-version", () => ({
  useRegistryModelVersion: vi.fn(),
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
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";
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

// One fully-usable card (7680 MiB / 100 core) plus two cards whose
// remaining memory (2048 MiB) cannot fit a 4096 MiB vGPU card: the card
// capacity is 1 while summed memory/core stay ample, so capacity warnings
// on this cluster come from the card-count dimension alone.
const multiReplicaVgpuCapacityCluster = {
  metadata: metadata("multi-replica-vgpu-capacity"),
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
            quantity: 3,
            product_groups: null,
            products: {
              "Tesla-T4": { quantity: 3 },
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
          allocatable: null,
          available: null,
          devices: [
            {
              uuid: "GPU-vgpu-capacity-a",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 15360, core_units: 100 },
              available: { memory_mib: 7680, core_units: 100 },
            },
            {
              uuid: "GPU-vgpu-capacity-b",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 8192, core_units: 100 },
              available: { memory_mib: 2048, core_units: 100 },
            },
            {
              uuid: "GPU-vgpu-capacity-c",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 8192, core_units: 100 },
              available: { memory_mib: 2048, core_units: 100 },
            },
          ],
        },
      },
    },
  },
} satisfies EndpointClusterRef;

// A capability block whose supported_resources omits core_percent: backend
// admission rejects it (NEU-645), so the UI must disable/clear it.
const coreUnsupportedVirtualizedKubernetesClusterWithDevices = {
  ...virtualizedKubernetesClusterWithDevices,
  metadata: metadata("core-unsupported-k8s-devices"),
  status: {
    ...virtualizedKubernetesClusterWithDevices.status,
    accelerator_virtualization: {
      supported_resources: ["virtualization.memory_mib"],
    },
  },
} satisfies EndpointClusterRef;

// Empty supported-resources list with a present capability block: backend
// slices.Contains never matches, so every virtualization key is rejected.
const emptyResourcesVirtualizedKubernetesClusterWithDevices = {
  ...virtualizedKubernetesClusterWithDevices,
  metadata: metadata("empty-resources-k8s-devices"),
  status: {
    ...virtualizedKubernetesClusterWithDevices.status,
    accelerator_virtualization: {
      supported_resources: [],
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
  registries: Array<{
    metadata: { name: string };
    visibility?: "public" | "private";
    status?: { phase?: string };
  }> = [],
  engines: Array<Record<string, unknown>> = [],
) {
  vi.mocked(useSelect).mockImplementation(((opts: { resource: string }) => {
    if (opts.resource === "model_catalogs") {
      return { query: { data: { data: catalogs }, isLoading: false } };
    }
    if (opts.resource === "clusters") {
      return { query: { data: { data: clusters }, isLoading: false } };
    }
    if (opts.resource === "model_registries") {
      return { query: { data: { data: registries }, isLoading: false } };
    }
    if (opts.resource === "engines") {
      return { query: { data: { data: engines }, isLoading: false } };
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

  vi.mocked(useRegistryModelVersion).mockReturnValue({
    model: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRegistryModelVersion>);
}

function engineRef(name: string, tasks: string[] = ["text-generation"]) {
  return {
    metadata: {
      name,
      workspace: "default",
      deletion_timestamp: null,
      creation_timestamp: "",
      update_timestamp: "",
      labels: {},
      annotations: {},
    },
    spec: {
      versions: [{ version: "v1", values_schema: {} }],
      supported_tasks: tasks,
    },
  };
}

// --- Test components ---

let formInstance: ReturnType<typeof useEndpointForm>["form"] | null = null;
let submitBlockedState = false;

function CreateForm() {
  const result = useEndpointForm({ action: "create" });
  formInstance = result.form;
  submitBlockedState = result.submitBlocked;
  return (
    <FormProvider {...result.form}>
      <form>
        {result.metadataFields}
        {result.templateFields}
        {result.weightFields}
        {result.resourceFields}
        {result.customizeFields}
      </form>
    </FormProvider>
  );
}

function EditForm() {
  const result = useEndpointForm({ action: "edit" });
  formInstance = result.form;
  submitBlockedState = result.submitBlocked;
  return (
    <FormProvider {...result.form}>
      <form>
        {result.metadataFields}
        {result.templateFields}
        {result.weightFields}
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
    submitBlockedState = false;
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
        // 2 replicas × 2 cards each now request 4 cards against a capacity
        // of 2: the cross-replica total drives the over-capacity warning.
        expect(getCurrentRequestText()).toContain("4.0 / 2.0");
      });
      expect(
        screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeTruthy();

      const cardCountInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.vgpuCount/i,
      }) as HTMLInputElement;
      expect(cardCountInput.max).toBe("2");

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 3);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("6.0 / 2.0");
      });
      expect(
        screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeTruthy();
    });

    it("shows original edit resources while reusing the endpoint allocation for scheduling", async () => {
      queryDataRef.current = {
        metadata: metadata("edit-resource-display-source"),
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
                instance_id: "edit-resource-display-source-0",
                replica_id: "edit-resource-display-source-0",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-11111111-2222-3333-4444-555555555555",
                    product: "Tesla-T4",
                    memory_mib: 7680,
                    core_units: 50,
                    node_id: "node-a",
                  },
                ],
              },
            ],
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

      const panel = within(
        await screen.findByTestId("endpoint-resource-context"),
      );
      const nodeACard = panel
        .getAllByTestId("endpoint-compact-node-card")
        .find((card) => card.textContent?.includes("node-a"));
      if (!nodeACard) throw new Error("node-a resource card is missing");

      const memoryPill = within(nodeACard)
        .getAllByTestId("endpoint-node-resource-pill")
        .find((pill) =>
          pill.textContent?.includes("clusters.fields.memoryUsage"),
        );
      if (!memoryPill) throw new Error("node-a memory pill is missing");

      await waitFor(() => {
        expect(
          within(memoryPill)
            .getAllByTestId("endpoint-node-resource-pill-value")
            .map((value) => value.textContent),
        ).toEqual(["15.0", "7.5", "7.5"]);
        expect(
          within(nodeACard).getByText(
            (_, node) => node?.textContent === "clusters.options.usable 1",
          ),
        ).toBeTruthy();
      });
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
        // Three virtual-card allocations pack onto two physical cards. The
        // Current Request panel reports physical-card usage while the memory
        // and core rows continue to report the requested virtual resources.
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

    it("keeps an unchanged legacy vGPU edit saveable but reevaluates scale-out", async () => {
      // This represents a legacy endpoint whose two replicas report the same
      // device. Preserve its unchanged edit path, then evaluate changed replica
      // counts against the current per-device memory/core budget.
      queryDataRef.current = {
        metadata: metadata("reusing-shared-vgpu-device"),
        spec: {
          cluster: "multi-replica-vgpu-capacity",
          replicas: { num: 2 },
          resources: {
            cpu: "2",
            memory: "8",
            gpu: "1",
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              "virtualization.memory_mib": "4096",
              "virtualization.core_percent": "100",
            },
          },
        },
        status: {
          resources: {
            replicas: [
              {
                instance_id: "shared-vgpu-a",
                replica_id: "shared-vgpu-a",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-vgpu-capacity-a",
                    product: "Tesla-T4",
                    memory_mib: 4096,
                    core_units: 100,
                    node_id: "node-a",
                  },
                ],
              },
              {
                instance_id: "shared-vgpu-b",
                replica_id: "shared-vgpu-b",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-vgpu-capacity-a",
                    product: "Tesla-T4",
                    memory_mib: 4096,
                    core_units: 100,
                    node_id: "node-a",
                  },
                ],
              },
            ],
            summary: {
              products: {
                "Tesla-T4": {
                  memory_mib: 8192,
                  core_units: 200,
                },
              },
            },
          },
        },
      };
      setupMocks([catalogA, catalogB], [multiReplicaVgpuCapacityCluster]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "multi-replica-vgpu-capacity");
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
      // The unchanged legacy request remains editable without retroactively
      // invalidating its persisted placement.
      expect(getCurrentRequestText()).toContain("2.0 / 2.0");
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();

      act(() => {
        formInstance?.setValue("spec.replicas.num", 3);
      });

      await waitFor(() => {
        // The legacy status cannot be used as a placement proof after scale-out;
        // the changed request is evaluated from the current residual resources.
        expect(getCurrentRequestText()).toContain("3.0 / 2.0");
        expect(
          screen.getByText("endpoints.messages.vgpuResourcesInsufficient"),
        ).toBeTruthy();
      });
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
      ).toContain("bg-amber-50");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("text-amber-700");
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
      expect(getCurrentRequestText()).toContain("4.0 / 1.0");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("bg-amber-50");
      expect(
        screen.getByText("endpoints.messages.cardsAvailable").className,
      ).toContain("text-amber-700");
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuResourcesInsufficient",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuMemoryResourcesInsufficient",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuCoreResourcesInsufficient",
      );
      expect(
        within(screen.getByTestId("endpoint-resource-plan-header")).queryByText(
          "endpoints.messages.vgpuResourcesInsufficient",
        ),
      ).toBeNull();
    });

    it("blocks multi-replica vGPU card count that fits per-replica but exceeds total capacity", async () => {
      setupMocks([catalogA, catalogB], [multiReplicaVgpuCapacityCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "multi-replica-vgpu-capacity");
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
      // 2 replicas × 1 vGPU card each request 2 cards against a capacity of
      // 1; the per-replica value (gpu=1) alone stays under capacity, so the
      // multi-replica total must drive the over-capacity warning.
      expect(getCurrentRequestText()).toContain("2.0 / 1.0");
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuResourcesInsufficient",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.partialGpuReplicaPlacement",
      );
    });

    it("reuses a vGPU card across replicas until its 17 GiB residual capacity is exhausted", async () => {
      const partialVgpuCluster = {
        metadata: metadata("partial-vgpu-17-gib"),
        spec: {
          type: "kubernetes",
          accelerator_virtualization: { enabled: true },
        },
        status: {
          resource_info: {
            accelerator_metadata: {
              nvidia_gpu: {
                products: { "NVIDIA-L20": { memory_total_mib: 49152 } },
              },
            },
            allocatable: {
              cpu: 16,
              memory: 64,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 3,
                  product_groups: { "NVIDIA-L20": 3 },
                  products: {
                    "NVIDIA-L20": {
                      quantity: 3,
                      virtualization: { memory_mib: 147456, core_units: 300 },
                    },
                  },
                },
              },
            },
            available: {
              cpu: 16,
              memory: 64,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 3,
                  product_groups: { "NVIDIA-L20": 3 },
                  products: {
                    "NVIDIA-L20": {
                      quantity: 3,
                      virtualization: { memory_mib: 81920, core_units: 300 },
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
                      quantity: 3,
                      product_groups: { "NVIDIA-L20": 3 },
                      products: {
                        "NVIDIA-L20": {
                          quantity: 3,
                          virtualization: {
                            memory_mib: 147456,
                            core_units: 300,
                          },
                        },
                      },
                    },
                  },
                },
                available: {
                  cpu: 16,
                  memory: 64,
                  accelerator_groups: {
                    nvidia_gpu: {
                      quantity: 3,
                      product_groups: { "NVIDIA-L20": 3 },
                      products: {
                        "NVIDIA-L20": {
                          quantity: 3,
                          virtualization: {
                            memory_mib: 81920,
                            core_units: 300,
                          },
                        },
                      },
                    },
                  },
                },
                devices: [
                  {
                    uuid: "GPU-vgpu-17-a",
                    product: "NVIDIA-L20",
                    health: true,
                    allocatable: { memory_mib: 49152, core_units: 100 },
                    available: { memory_mib: 49152, core_units: 100 },
                  },
                  {
                    uuid: "GPU-vgpu-17-b",
                    product: "NVIDIA-L20",
                    health: true,
                    allocatable: { memory_mib: 49152, core_units: 100 },
                    available: { memory_mib: 16384, core_units: 100 },
                  },
                  {
                    uuid: "GPU-vgpu-17-c",
                    product: "NVIDIA-L20",
                    health: true,
                    allocatable: { memory_mib: 49152, core_units: 100 },
                    available: { memory_mib: 16384, core_units: 100 },
                  },
                ],
              },
            },
          },
        },
      } satisfies EndpointClusterRef;

      setupMocks([catalogA, catalogB], [partialVgpuCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "partial-vgpu-17-gib");
        formInstance?.setValue("spec.replicas.num", 2);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "NVIDIA-L20",
            virtualization: {
              memory_mib: 17 * 1024,
              core_percent: 0,
            },
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(false));
      // Two virtual cards share the 48 GiB physical card, so Current Request
      // reports one physical card in use rather than two virtual cards.
      expect(getCurrentRequestText()).toContain("1.0 / 1.0");
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.messages.vgpuResourcesInsufficient",
      );

      act(() => {
        formInstance?.setValue("spec.replicas.num", 3);
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(getCurrentRequestText()).toContain("3.0 / 1.0");
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuResourcesInsufficient",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.partialGpuReplicaPlacement",
      );
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.messages.vgpuMemoryResourcesInsufficient",
      );
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.messages.vgpuCoreResourcesInsufficient",
      );
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

    it("allows static fractional replicas when per-card core fits despite low VRAM", async () => {
      const fractionalCoreOnlyCluster = JSON.parse(
        JSON.stringify(staticNodeClusterWithNodeResources),
      ) as EndpointClusterRef;
      fractionalCoreOnlyCluster.metadata = metadata("fractional-core-only");
      const resourceInfo = fractionalCoreOnlyCluster.status?.resource_info;
      const device = resourceInfo?.node_resources?.["node-a"]?.devices?.[0];
      if (!device) throw new Error("fractional fixture is incomplete");
      device.available = { memory_mib: 0, core_units: 100 };

      setupMocks([catalogA, catalogB], [fractionalCoreOnlyCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "fractional-core-only");
        formInstance?.setValue("spec.replicas.num", 2);
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

      await waitFor(() => expect(submitBlockedState).toBe(false));
      expect(getAcceleratorCardText()).not.toContain(
        "endpoints.messages.fractionalGpuResourcesInsufficient",
      );
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
          "endpoints.messages.fractionalGpuResourcesInsufficient",
        );
        expect(getAcceleratorCardText()).toContain(
          "endpoints.messages.partialGpuReplicaPlacement",
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
      expect(getCurrentRequestText()).toContain("1.0 / 2.0");
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

    it("keeps a shared-vGPU edit scale-up available when topology falls back to aggregate resources", async () => {
      const aggregateOnlySharedVgpuCluster = JSON.parse(
        JSON.stringify(virtualizedKubernetesClusterWithoutDeviceDetails),
      ) as EndpointClusterRef;
      aggregateOnlySharedVgpuCluster.metadata = metadata(
        "aggregate-shared-vgpu-edit",
      );
      const product =
        aggregateOnlySharedVgpuCluster.status?.resource_info?.available
          ?.accelerator_groups?.nvidia_gpu?.products?.["Tesla-T4"];
      const allocatableProduct =
        aggregateOnlySharedVgpuCluster.status?.resource_info?.allocatable
          ?.accelerator_groups?.nvidia_gpu?.products?.["Tesla-T4"];
      if (!product?.virtualization || !allocatableProduct?.virtualization) {
        throw new Error("shared-vGPU aggregate fixture is incomplete");
      }
      // The aggregate view has only one more 8 GiB / 50-core slice. The
      // endpoint's three existing slices must be added back for unchanged
      // edit and the fourth slice to remain valid without device topology.
      allocatableProduct.virtualization.memory_mib = 32768;
      allocatableProduct.virtualization.core_units = 200;
      product.virtualization.memory_mib = 8192;
      product.virtualization.core_units = 50;

      queryDataRef.current = {
        metadata: metadata("aggregate-shared-vgpu-existing"),
        spec: {
          cluster: "aggregate-shared-vgpu-edit",
          replicas: { num: 3 },
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
                instance_id: "aggregate-shared-vgpu-existing-0",
                replica_id: "aggregate-shared-vgpu-existing-0",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-shared-vgpu-current",
                    product: "Tesla-T4",
                    memory_mib: 8192,
                    core_units: 50,
                    node_id: "node-a",
                  },
                ],
              },
              {
                instance_id: "aggregate-shared-vgpu-existing-1",
                replica_id: "aggregate-shared-vgpu-existing-1",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-shared-vgpu-current",
                    product: "Tesla-T4",
                    memory_mib: 8192,
                    core_units: 50,
                    node_id: "node-a",
                  },
                ],
              },
              {
                instance_id: "aggregate-shared-vgpu-existing-2",
                replica_id: "aggregate-shared-vgpu-existing-2",
                node_id: "node-a",
                devices: [
                  {
                    uuid: "GPU-shared-vgpu-current",
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
                  memory_mib: 24576,
                  core_units: 150,
                },
              },
            },
          },
        },
      };
      setupMocks([catalogA, catalogB], [aggregateOnlySharedVgpuCluster]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());
      act(() => {
        formInstance?.setValue("spec.cluster", "aggregate-shared-vgpu-edit");
        formInstance?.setValue("spec.replicas.num", 3);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("3.0 / 2.0");
        expect(submitBlockedState).toBe(false);
      });

      act(() => {
        formInstance?.setValue("spec.replicas.num", 4);
      });

      await waitFor(() => {
        expect(getCurrentRequestText()).toContain("4.0 / 2.0");
        expect(submitBlockedState).toBe(false);
      });
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
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
        [coreUnsupportedVirtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "core-unsupported-k8s-devices");
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
      expect(
        screen.getByText("endpoints.messages.vgpuCoreLimitUnsupportedMode"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.vgpuCoreLimitUnlimitedHint"),
      ).toBeNull();
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
      expect(
        screen.getByText("endpoints.messages.vgpuCoreLimitUnlimitedHint"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.vgpuCoreLimitUnsupportedMode"),
      ).toBeNull();
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
          coreUnsupportedVirtualizedKubernetesClusterWithDevices,
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
        formInstance?.setValue("spec.cluster", "core-unsupported-k8s-devices");
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
          cluster: "core-unsupported-k8s-devices",
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
        [coreUnsupportedVirtualizedKubernetesClusterWithDevices],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "core-unsupported-k8s-devices");
      });

      await waitFor(() => {
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toEqual({ memory_mib: 8192 });
      });
    });

    it("disables and clears both split inputs when the cluster reports an empty supported-resources list", async () => {
      setupMocks(
        [catalogA, catalogB],
        [emptyResourcesVirtualizedKubernetesClusterWithDevices],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "empty-resources-k8s-devices");
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
      expect(memoryInput.disabled).toBe(true);

      await waitFor(() => {
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toBeUndefined();
      });
    });

    it("explains when no node can schedule a multi-card replica", async () => {
      const fragmentedFullGpuCluster = JSON.parse(
        JSON.stringify(plainKubernetesClusterWithNodeResources),
      ) as EndpointClusterRef;
      fragmentedFullGpuCluster.metadata = metadata("fragmented-full-gpu");
      const resourceInfo = fragmentedFullGpuCluster.status?.resource_info;
      if (!resourceInfo) throw new Error("resource fixture is incomplete");

      for (const node of Object.values(resourceInfo.node_resources ?? {})) {
        for (const device of node.devices ?? []) {
          device.available = device.allocatable;
        }
      }

      setupMocks([catalogA, catalogB], [fragmentedFullGpuCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "fragmented-full-gpu");
        formInstance?.setValue("spec.replicas.num", 1);
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

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.noNodeCanScheduleFullGpuRequest"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("explains when full-card capacity is insufficient across the cluster", async () => {
      setupMocks(
        [catalogA, catalogB],
        [plainKubernetesClusterWithNodeResources],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "plain-k8s-node-resources");
        formInstance?.setValue("spec.replicas.num", 1);
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

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.fullGpuCardCapacityInsufficient"),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          "endpoints.messages.noNodeCanScheduleFullGpuRequest",
        ),
      ).toBeNull();
    });

    it("explains when no healthy accelerator matches the requested product", async () => {
      setupMocks(
        [catalogA, catalogB],
        [plainKubernetesClusterWithNodeResources],
      );
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "plain-k8s-node-resources");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "NVIDIA-L20",
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.noMatchingAccelerator"),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          "endpoints.messages.fullGpuCardCapacityInsufficient",
        ),
      ).toBeNull();
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("keeps a vGPU product mismatch distinct from memory and core exhaustion", async () => {
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
            product: "NVIDIA-L20",
            virtualization: {
              memory_mib: 4096,
              core_percent: 50,
            },
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.noMatchingAccelerator"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
      expect(
        screen.queryByText(
          "endpoints.messages.vgpuMemoryResourcesInsufficient",
        ),
      ).toBeNull();
      expect(
        screen.queryByText("endpoints.messages.vgpuCoreResourcesInsufficient"),
      ).toBeNull();
    });

    it("explains vGPU placement when cards exist only on different nodes", async () => {
      const distributedVgpuCluster = JSON.parse(
        JSON.stringify(virtualizedKubernetesClusterWithDevices),
      ) as EndpointClusterRef;
      distributedVgpuCluster.metadata = metadata("distributed-vgpu-placement");
      const resourceInfo = distributedVgpuCluster.status?.resource_info;
      if (!resourceInfo) throw new Error("resource fixture is incomplete");

      for (const node of Object.values(resourceInfo.node_resources ?? {})) {
        for (const device of node.devices ?? []) {
          device.available = {
            memory_mib: 7680,
            core_units: 100,
          };
        }
      }

      setupMocks([catalogA, catalogB], [distributedVgpuCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "distributed-vgpu-placement");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 8,
          gpu: 2,
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

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.noNodeCanScheduleVgpuRequest"),
      ).toBeTruthy();
    });

    it("explains node CPU fragmentation independently from GPU capacity", async () => {
      const cpuFragmentedCluster = JSON.parse(
        JSON.stringify(plainKubernetesClusterWithNodeResources),
      ) as EndpointClusterRef;
      cpuFragmentedCluster.metadata = metadata("cpu-fragmented-placement");
      const resourceInfo = cpuFragmentedCluster.status?.resource_info;
      if (!resourceInfo?.available || !resourceInfo.node_resources) {
        throw new Error("resource fixture is incomplete");
      }
      resourceInfo.available.cpu = 2;

      for (const node of Object.values(resourceInfo.node_resources)) {
        if (!node.available) throw new Error("node fixture is incomplete");
        node.available.cpu = 1;
        for (const device of node.devices ?? []) {
          device.available = device.allocatable;
        }
      }

      setupMocks([catalogA, catalogB], [cpuFragmentedCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "cpu-fragmented-placement");
        formInstance?.setValue("spec.replicas.num", 1);
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

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.noNodeCanScheduleCpuRequest"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("keeps an aggregate CPU shortage distinct from combined node placement", async () => {
      const cpuInsufficientCluster = JSON.parse(
        JSON.stringify(plainKubernetesClusterWithNodeResources),
      ) as EndpointClusterRef;
      cpuInsufficientCluster.metadata = metadata("cpu-insufficient-placement");
      const resourceInfo = cpuInsufficientCluster.status?.resource_info;
      if (!resourceInfo?.available || !resourceInfo.node_resources) {
        throw new Error("resource fixture is incomplete");
      }
      resourceInfo.available.cpu = 2;

      for (const node of Object.values(resourceInfo.node_resources)) {
        if (!node.available) throw new Error("node fixture is incomplete");
        node.available.cpu = 1;
        for (const device of node.devices ?? []) {
          device.available = device.allocatable;
        }
      }

      setupMocks([catalogA, catalogB], [cpuInsufficientCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "cpu-insufficient-placement");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 3,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.cpuResourcesInsufficient"),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          "endpoints.messages.noNodeCanScheduleCombinedResourceRequest",
        ),
      ).toBeNull();
    });

    it("explains node memory fragmentation independently from GPU capacity", async () => {
      const memoryFragmentedCluster = JSON.parse(
        JSON.stringify(plainKubernetesClusterWithNodeResources),
      ) as EndpointClusterRef;
      memoryFragmentedCluster.metadata = metadata(
        "memory-fragmented-placement",
      );
      const resourceInfo = memoryFragmentedCluster.status?.resource_info;
      if (!resourceInfo?.available || !resourceInfo.node_resources) {
        throw new Error("resource fixture is incomplete");
      }
      resourceInfo.available.memory = 16;

      for (const node of Object.values(resourceInfo.node_resources)) {
        if (!node.available) throw new Error("node fixture is incomplete");
        node.available.memory = 8;
        for (const device of node.devices ?? []) {
          device.available = device.allocatable;
        }
      }

      setupMocks([catalogA, catalogB], [memoryFragmentedCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "memory-fragmented-placement");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 2,
          memory: 16,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.noNodeCanScheduleMemoryRequest"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("explains when CPU and memory only fit on different GPU nodes", async () => {
      const combinedFragmentedCluster = JSON.parse(
        JSON.stringify(plainKubernetesClusterWithNodeResources),
      ) as EndpointClusterRef;
      combinedFragmentedCluster.metadata = metadata(
        "combined-fragmented-placement",
      );
      const resourceInfo = combinedFragmentedCluster.status?.resource_info;
      const nodeA = resourceInfo?.node_resources?.["node-a"];
      const nodeB = resourceInfo?.node_resources?.["node-b"];
      if (!resourceInfo?.available || !nodeA?.available || !nodeB?.available) {
        throw new Error("resource fixture is incomplete");
      }
      resourceInfo.available.cpu = 5;
      resourceInfo.available.memory = 5;
      nodeA.available.cpu = 4;
      nodeA.available.memory = 1;
      nodeB.available.cpu = 1;
      nodeB.available.memory = 4;
      for (const node of [nodeA, nodeB]) {
        for (const device of node.devices ?? []) {
          device.available = device.allocatable;
        }
      }

      setupMocks([catalogA, catalogB], [combinedFragmentedCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "combined-fragmented-placement");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 4,
          memory: 4,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText(
          "endpoints.messages.noNodeCanScheduleCombinedResourceRequest",
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.cpuResourcesInsufficient"),
      ).toBeNull();
      expect(
        screen.queryByText("endpoints.messages.memoryResourcesInsufficient"),
      ).toBeNull();
    });

    it("keeps aggregate CPU and memory distinct when only GPU replica capacity is exhausted", async () => {
      const gpuLimitedCluster = JSON.parse(
        JSON.stringify(plainKubernetesClusterWithNodeResources),
      ) as EndpointClusterRef;
      gpuLimitedCluster.metadata = metadata("gpu-limited-replica-capacity");
      const resourceInfo = gpuLimitedCluster.status?.resource_info;
      if (!resourceInfo?.available || !resourceInfo.node_resources) {
        throw new Error("resource fixture is incomplete");
      }
      resourceInfo.available.cpu = 16;
      resourceInfo.available.memory = 64;

      for (const node of Object.values(resourceInfo.node_resources)) {
        if (!node.available) throw new Error("node fixture is incomplete");
        node.available.cpu = 8;
        node.available.memory = 32;
        for (const device of node.devices ?? []) {
          device.available = device.allocatable;
        }
      }

      setupMocks([catalogA, catalogB], [gpuLimitedCluster]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "gpu-limited-replica-capacity");
        formInstance?.setValue("spec.replicas.num", 3);
        formInstance?.setValue("spec.resources", {
          cpu: 4,
          memory: 20,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(true));
      expect(
        screen.getByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeTruthy();
      expect(
        screen.queryByText("endpoints.messages.cpuResourcesInsufficient"),
      ).toBeNull();
      expect(
        screen.queryByText("endpoints.messages.memoryResourcesInsufficient"),
      ).toBeNull();
    });

    it("adds back known edit replica CPU and memory without device allocations", async () => {
      queryDataRef.current = {
        metadata: metadata("cpu-memory-edit"),
        spec: {
          cluster: "plain-k8s-node-resources",
          replicas: { num: 2 },
          resources: {
            cpu: "4",
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
                instance_id: "cpu-memory-edit-a",
                node_id: "node-a",
                devices: [],
              },
            ],
          },
        },
      };
      setupMocks(
        [catalogA, catalogB],
        [plainKubernetesClusterWithNodeResources],
      );
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "plain-k8s-node-resources");
        formInstance?.setValue("spec.replicas.num", 1);
        formInstance?.setValue("spec.resources", {
          cpu: 12,
          memory: 8,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
        });
      });

      await waitFor(() => expect(submitBlockedState).toBe(false));
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
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

  describe("GPU count precision (resolver)", () => {
    beforeEach(() => {
      setupMocks();
      mockUseWorkspace.mockReset();
    });

    const selectKubernetesAccelerator = () => {
      act(() => {
        formInstance?.setValue("spec.cluster", "plain-k8s");
        formInstance?.setValue("spec.resources", {
          cpu: 1,
          memory: 4,
          gpu: 0,
          accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        });
      });
    };

    it("shows a GPU count error for a fractional count on a kubernetes cluster", async () => {
      setupMocks([catalogA, catalogB], [plainKubernetesCluster]);
      render(<CreateForm />);
      await waitFor(() => expect(formInstance).not.toBeNull());

      selectKubernetesAccelerator();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 1.5);
      });

      await act(async () => {
        await formInstance!.trigger("spec.resources.gpu");
      });

      expect(
        screen.getByText("endpoints.messages.gpuCountPrecisionK8s"),
      ).toBeTruthy();
    });

    it("allows a zero count on a kubernetes cluster as the unselect value", async () => {
      setupMocks([catalogA, catalogB], [plainKubernetesCluster]);
      render(<CreateForm />);
      await waitFor(() => expect(formInstance).not.toBeNull());

      selectKubernetesAccelerator();

      await act(async () => {
        await formInstance!.trigger("spec.resources.gpu");
      });

      expect(
        screen.queryByText("endpoints.messages.gpuCountPrecisionK8s"),
      ).toBeNull();
    });

    it("allows an integer count on a kubernetes cluster", async () => {
      setupMocks([catalogA, catalogB], [plainKubernetesCluster]);
      render(<CreateForm />);
      await waitFor(() => expect(formInstance).not.toBeNull());

      selectKubernetesAccelerator();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 2);
      });

      await act(async () => {
        await formInstance!.trigger("spec.resources.gpu");
      });

      expect(
        screen.queryByText("endpoints.messages.gpuCountPrecisionK8s"),
      ).toBeNull();
    });

    const selectSshAccelerator = () => {
      act(() => {
        formInstance?.setValue("spec.cluster", "static-node-resources");
        formInstance?.setValue("spec.resources", {
          cpu: 1,
          memory: 4,
          gpu: 0,
          accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        });
      });
    };

    it("shows a GPU count error for a non-integer count at or above one on an ssh cluster", async () => {
      setupMocks([catalogA, catalogB], [staticNodeClusterWithNodeResources]);
      render(<CreateForm />);
      await waitFor(() => expect(formInstance).not.toBeNull());

      selectSshAccelerator();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 1.5);
      });

      await act(async () => {
        await formInstance!.trigger("spec.resources.gpu");
      });

      expect(
        screen.getByText("endpoints.messages.gpuCountPrecisionSsh"),
      ).toBeTruthy();
    });

    it("allows a one-decimal count below one on an ssh cluster", async () => {
      setupMocks([catalogA, catalogB], [staticNodeClusterWithNodeResources]);
      render(<CreateForm />);
      await waitFor(() => expect(formInstance).not.toBeNull());

      selectSshAccelerator();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 0.5);
      });

      await act(async () => {
        await formInstance!.trigger("spec.resources.gpu");
      });

      expect(
        screen.queryByText("endpoints.messages.gpuCountPrecisionSsh"),
      ).toBeNull();
    });

    it("shows a GPU count error for a multi-decimal count below one on an ssh cluster", async () => {
      setupMocks([catalogA, catalogB], [staticNodeClusterWithNodeResources]);
      render(<CreateForm />);
      await waitFor(() => expect(formInstance).not.toBeNull());

      selectSshAccelerator();

      act(() => {
        formInstance?.setValue("spec.resources.gpu", 0.15);
      });

      await act(async () => {
        await formInstance!.trigger("spec.resources.gpu");
      });

      expect(
        screen.getByText("endpoints.messages.gpuCountPrecisionSsh"),
      ).toBeTruthy();
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

describe("what the chosen registry costs at deploy time", () => {
  const withRegistry = async (
    registries: Array<{
      metadata: { name: string };
      visibility?: "public" | "private";
    }>,
    name: string,
  ) => {
    setupMocks([catalogA, catalogB], [], registries);
    // This block sits outside the suite that resets it in `beforeEach`, and a
    // stale instance would let the wait below pass against the previous test's
    // form.
    formInstance = null;
    render(<CreateForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());
    await act(async () => {
      formInstance?.setValue("spec.model.registry", name);
    });
  };

  it("warns when the registry's models are fetched as the endpoint starts", async () => {
    await withRegistry(
      [{ metadata: { name: "hub" }, visibility: "public" }],
      "hub",
    );

    expect(screen.getByTestId("endpoint-runtime-download-hint")).toBeDefined();
    expect(
      screen.queryByTestId("endpoint-runtime-download-unknown"),
    ).toBeNull();
  });

  it("says nothing for a registry whose models are already on local storage", async () => {
    await withRegistry(
      [{ metadata: { name: "nfs" }, visibility: "private" }],
      "nfs",
    );

    expect(screen.queryByTestId("endpoint-runtime-download-hint")).toBeNull();
    expect(
      screen.queryByTestId("endpoint-runtime-download-unknown"),
    ).toBeNull();
  });

  it("says something when the registry did not state which it is", async () => {
    // The regression this exists for. `visibility` is a computed field, so a
    // request here that drops MODEL_REGISTRY_SELECT gets `undefined` rather than
    // an error — and the honest failure is loud, not a warning that quietly
    // stops appearing and is reported months later as a slow first start nobody
    // was told about.
    await withRegistry([{ metadata: { name: "unstated" } }], "unstated");

    expect(
      screen.getByTestId("endpoint-runtime-download-unknown"),
    ).toBeDefined();
    expect(screen.queryByTestId("endpoint-runtime-download-hint")).toBeNull();
  });

  it("claims nothing before the registry list has arrived", async () => {
    // No record is "no answer yet", which is not the same as an answer with the
    // field missing; neither notice belongs on screen for it.
    await withRegistry([], "not-loaded-yet");

    expect(screen.queryByTestId("endpoint-runtime-download-hint")).toBeNull();
    expect(
      screen.queryByTestId("endpoint-runtime-download-unknown"),
    ).toBeNull();
  });
});

describe("engines that need no model spec", () => {
  // The Flex engine runs an arbitrary workload; Neutree manages no model for it,
  // so the form must not ask which model to serve.
  const modelFieldLabels = [
    "endpoints.fields.modelRegistry",
    "endpoints.fields.modelName",
    "endpoints.fields.modelVersion",
    "endpoints.fields.modelFile",
    "endpoints.fields.taskType",
  ];

  it("hides every model field once Flex is selected", async () => {
    setupMocks([], [], [], [engineRef("flex"), engineRef("vllm")]);
    render(<CreateForm />);

    await act(async () => {
      formInstance?.setValue("spec.engine", { engine: "flex", version: "v1" });
    });

    for (const label of modelFieldLabels) {
      expect(screen.queryByText(label)).toBeNull();
    }
    // Replicas shares the card with the model fields and must survive.
    expect(screen.queryByText("endpoints.fields.replicas")).not.toBeNull();
  });

  it("keeps them for an ordinary engine", async () => {
    setupMocks([], [], [], [engineRef("flex"), engineRef("vllm")]);
    render(<CreateForm />);

    await act(async () => {
      formInstance?.setValue("spec.engine", { engine: "vllm", version: "v1" });
    });

    for (const label of modelFieldLabels) {
      expect(screen.queryByText(label)).not.toBeNull();
    }
  });
});

describe("model picker", () => {
  // Renaming the alias later must leave this endpoint pointing where it was.
  it("labels a model by its alias but submits the physical name", async () => {
    setupMocks([], [], [{ metadata: { name: "hf" } }]);
    vi.mocked(useRegistryModels).mockReturnValue({
      page: null,
      models: [
        {
          name: "Qwen/Qwen3-8B",
          versions: [{ name: "v2", creation_time: "", alias: "qwen-chat" }],
        },
      ],
      total: 1,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRegistryModels>);

    render(<CreateForm />);

    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
    });

    const field = screen.getByTestId("field-spec.model.name");
    const trigger = field.querySelector('button[role="combobox"]');
    if (!trigger) throw new Error("model combobox trigger not found");

    await act(async () => {
      fireEvent.click(trigger);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "qwen-chat" }));
    });

    expect(formInstance?.getValues().spec.model.name).toBe("Qwen/Qwen3-8B");
    expect(formInstance?.getValues().spec.model.version).toBe("v2");
  });
});

describe("model static parameters", () => {
  const pickQwen = async () => {
    const field = screen.getByTestId("field-spec.model.name");
    const trigger = field.querySelector('button[role="combobox"]');
    if (!trigger) throw new Error("model combobox trigger not found");

    await act(async () => {
      fireEvent.click(trigger);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "Qwen/Qwen3-8B" }));
    });
  };

  const withOneModel = () => {
    setupMocks([], [], [{ metadata: { name: "hf" } }]);
    vi.mocked(useRegistryModels).mockReturnValue({
      page: null,
      models: [
        {
          name: "Qwen/Qwen3-8B",
          versions: [{ name: "v2", creation_time: "" }],
        },
      ],
      total: 1,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRegistryModels>);
  };

  it("fills them in from the detail read when a model is picked", async () => {
    withOneModel();
    vi.mocked(useRegistryModelVersion).mockReturnValue({
      model: {
        name: "v2",
        creation_time: "",
        info: { parameter_count: "8B", num_hidden_layers: 36 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRegistryModelVersion>);

    render(<CreateForm />);
    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
    });
    await pickQwen();

    expect(formInstance?.getValues().spec.model.info).toEqual({
      parameter_count: "8B",
      num_hidden_layers: 36,
    });
  });

  // The previous model's numbers must not stay on screen while the read for the
  // new one is still in flight.
  it("clears them while the detail read is still in flight", async () => {
    withOneModel();
    vi.mocked(useRegistryModelVersion).mockReturnValue({
      model: null,
      isLoading: true,
      isFetching: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRegistryModelVersion>);

    render(<CreateForm />);
    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
      formInstance?.setValue("spec.model.info", { parameter_count: "72B" });
    });
    await pickQwen();

    expect(formInstance?.getValues().spec.model.info).toBeNull();
  });

  // A read that fails settles with nothing, and nothing is the honest answer.
  it("leaves them empty when the detail read comes back with nothing", async () => {
    withOneModel();

    render(<CreateForm />);
    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
      formInstance?.setValue("spec.model.info", { parameter_count: "72B" });
    });
    await pickQwen();

    expect(formInstance?.getValues().spec.model.info).toBeNull();
  });
});

describe("registries that cannot be listed from", () => {
  const registryOption = (name: string) =>
    screen
      .getAllByRole("option")
      .find((option) => option.textContent?.startsWith(name));

  it("offers an unreachable registry but does not let it be chosen", async () => {
    setupMocks(
      [],
      [],
      [
        { metadata: { name: "live" }, status: { phase: "Connected" } },
        { metadata: { name: "down" }, status: { phase: "Failed" } },
      ],
    );

    render(<CreateForm />);

    const field = screen.getByTestId("field-spec.model.registry");
    const trigger = field.querySelector('button[role="combobox"]');
    if (!trigger) throw new Error("registry combobox trigger not found");

    await act(async () => {
      fireEvent.click(trigger);
    });

    const down = registryOption("down");
    if (!down) throw new Error("unreachable registry missing from the list");
    expect(down.getAttribute("data-disabled")).toBe("true");

    await act(async () => {
      fireEvent.click(down);
    });
    expect(formInstance?.getValues().spec.model.registry).toBe("");
  });

  it("lets a healthy one be chosen", async () => {
    setupMocks(
      [],
      [],
      [
        { metadata: { name: "live" }, status: { phase: "Connected" } },
        { metadata: { name: "down" }, status: { phase: "Failed" } },
      ],
    );

    render(<CreateForm />);

    const field = screen.getByTestId("field-spec.model.registry");
    const trigger = field.querySelector('button[role="combobox"]');
    if (!trigger) throw new Error("registry combobox trigger not found");

    await act(async () => {
      fireEvent.click(trigger);
    });

    const live = registryOption("live");
    if (!live) throw new Error("healthy registry missing from the list");

    await act(async () => {
      fireEvent.click(live);
    });
    expect(formInstance?.getValues().spec.model.registry).toBe("live");
  });
});

describe("a catalog naming a registry this workspace does not have", () => {
  const registryError = async (registry: string) => {
    setupMocks([], [], [{ metadata: { name: "mine" } }]);
    render(<CreateForm />);

    await act(async () => {
      formInstance?.setValue("spec.model.registry", registry);
    });
    // A separate pass: the resolver closes over the previous render's watched
    // value, so validating in the same act would judge the empty field.
    await act(async () => {
      await formInstance?.trigger();
    });

    return formInstance?.formState.errors?.["spec.model.registry"];
  };

  it("says so instead of leaving the field looking unfilled", async () => {
    const error = await registryError("someone-elses-registry");

    expect(error?.message).toBe(
      "endpoints.messages.modelRegistryNotInWorkspace",
    );
  });

  it("stays quiet for a registry that is there", async () => {
    expect(await registryError("mine")).toBeUndefined();
  });
});

// An endpoint holds the composed result and nothing that says what produced
// it, so the deployment records that on itself. Read back on the endpoint's own
// pages; never followed back to the catalog.
describe("what a deploy came from is recorded on the endpoint", () => {
  const submitted = () => refineCoreOnFinishMock.mock.calls[0]?.[0];
  const annotations = () => submitted()?.metadata?.annotations ?? {};

  const deployFrom = async (name: string) => {
    render(<CreateForm />);
    selectCatalog(name);
    await act(async () => {
      await formInstance?.refineCore.onFinish(formInstance.getValues());
    });
  };

  beforeEach(() => {
    refineCoreOnFinishMock.mockClear();
  });

  it("names the catalog, the variant and the chosen features", async () => {
    setupMocks([catalogA, recipeCatalog], [plainKubernetesCluster]);
    await deployFrom("recipe-mc");

    expect(annotations()["neutree.ai/model-catalog"]).toBe("recipe-mc");
    expect(annotations()["neutree.ai/model-catalog-variant"]).toBe("default");
  });

  // A plain catalog has no variants to choose between.
  it("names only the catalog for a plain one", async () => {
    setupMocks([catalogA, recipeCatalog], [plainKubernetesCluster]);
    await deployFrom("vllm-llama");

    expect(annotations()["neutree.ai/model-catalog"]).toBe("vllm-llama");
    expect(annotations()["neutree.ai/model-catalog-variant"]).toBeUndefined();
  });

  it("records nothing when the endpoint was not deployed from a catalog", async () => {
    setupMocks([catalogA], [plainKubernetesCluster]);
    render(<CreateForm />);
    await act(async () => {
      await formInstance?.refineCore.onFinish(formInstance.getValues());
    });

    expect(annotations()["neutree.ai/model-catalog"]).toBeUndefined();
  });
});

// The composed model address must track the selected catalog's own data, not
// just the events (variant/feature change) that used to re-derive it. Editing
// the catalog's underlying model elsewhere and having the catalog list
// refetch is exactly such a change with no variant/feature event attached.
describe("a recipe catalog's own data changing re-composes the form", () => {
  it("updates the model address once the selected catalog refetches, without a variant switch", () => {
    setupMocks([catalogA, recipeCatalog], [plainKubernetesCluster]);
    const { rerender } = render(<CreateForm />);
    selectCatalog("recipe-mc");

    expect(formInstance?.getValues("spec.model.name")).toBe("org/recipe-model");

    const editedRecipeCatalog = {
      ...recipeCatalog,
      spec: {
        ...recipeCatalog.spec,
        variants: {
          default: {
            model: {
              ...recipeCatalog.spec.variants.default.model,
              name: "org/local-recipe-model",
              registry: "local",
            },
          },
        },
      },
    };

    setupMocks([catalogA, editedRecipeCatalog], [plainKubernetesCluster]);
    rerender(<CreateForm />);

    expect(formInstance?.getValues("spec.model.name")).toBe(
      "org/local-recipe-model",
    );
    expect(formInstance?.getValues("spec.model.registry")).toBe("local");
  });
});

// The shared CreateForm harness leaves out the recipe slots; the real page
// (pages/endpoints/create.tsx) renders them all, and these tests are about
// what that page shows.
function RecipeCreateForm() {
  const result = useEndpointForm({ action: "create" });
  formInstance = result.form;
  submitBlockedState = result.submitBlocked;
  return (
    <FormProvider {...result.form}>
      <form>
        {result.metadataFields}
        {result.advancedToggle}
        {result.templateFields}
        {result.recipeFields}
        {result.weightFields}
        {result.resourceFields}
        {result.customizeFields}
      </form>
    </FormProvider>
  );
}

// The simplified recipe form folds engine, engine args and env away, so
// without this there is no way to see what the deploy will actually run. The
// same reason the capacity warnings and compose errors already pierce it.
describe("what a recipe deploy will run stays visible", () => {
  const renderRecipeDeploy = () => {
    setupMocks([catalogA, recipeCatalog], [plainKubernetesCluster]);
    render(<RecipeCreateForm />);
    selectCatalog("recipe-mc");
  };

  it("summarises the composed engine without expanding anything", () => {
    renderRecipeDeploy();

    const toggle = screen.getByTestId("compose-preview-toggle");
    expect(toggle.textContent).toContain("vllm");
    expect(toggle.textContent).toContain("0.8.5");
    expect(toggle.textContent).toContain("text-generation");
  });

  it("opens to the full composition", () => {
    renderRecipeDeploy();

    expect(screen.getByTestId("compose-preview").textContent).not.toContain(
      "org/recipe-model",
    );

    fireEvent.click(screen.getByTestId("compose-preview-toggle"));

    expect(screen.getByTestId("compose-preview").textContent).toContain(
      "org/recipe-model",
    );
  });

  // Standalone deploy has no disclosure at all, so there is nothing to fold
  // against — the preview is simply open.
  it("is not folded once the advanced options are shown", async () => {
    renderRecipeDeploy();

    await act(async () => {
      fireEvent.click(screen.getByText("endpoints.simplified.showAdvanced"));
    });

    expect(screen.queryByTestId("compose-preview-toggle")).toBeNull();
    expect(screen.getByTestId("compose-preview").textContent).toContain(
      "org/recipe-model",
    );
  });
});

// A recipe's validated GPU list is advice. It orders and labels the picker; it
// never removes an option, so both modes offer the same set (NEU-590 already
// had to walk back hiding the picker entirely).
describe("validated accelerators are ranked, not filtered", () => {
  const withVerified = (verified: string) => ({
    ...recipeCatalog,
    metadata: {
      name: "recipe-mc",
      annotations: { "recipe.vllm.ai/hardware-verified": verified },
    },
  });

  // The shared fixture's cluster has one GPU product, which cannot show that a
  // card the recipe does not name survives beside one it does.
  const twoProductCluster = (() => {
    const cluster = structuredClone(plainKubernetesClusterWithNodeResources);
    for (const bucket of ["allocatable", "available"] as const) {
      (
        cluster.status.resource_info as unknown as Record<
          string,
          {
            accelerator_groups: Record<
              string,
              { product_groups: Record<string, number> }
            >;
          }
        >
      )[bucket].accelerator_groups.nvidia_gpu.product_groups["A100-SXM4"] = 1;
    }
    return cluster;
  })();

  const renderOnGpuCluster = async (verified: string) => {
    setupMocks([catalogA, withVerified(verified)], [twoProductCluster]);
    render(<RecipeCreateForm />);
    selectCatalog("recipe-mc");
    await act(async () => {
      formInstance?.setValue("spec.cluster", "plain-k8s-node-resources");
    });

    const field = screen.getByTestId("field-spec.resources.accelerator");
    const trigger = field.querySelector('button[role="combobox"]');
    if (!trigger) throw new Error("accelerator combobox trigger not found");
    fireEvent.click(trigger);

    return screen.getAllByRole("option");
  };

  it("offers the cards the recipe does not name, ranked below the ones it does", async () => {
    const options = await renderOnGpuCluster("T4");
    const text = options.map((option) => option.textContent ?? "");

    expect(text.some((label) => label.includes("A100"))).toBe(true);
    expect(text.findIndex((label) => label.includes("T4"))).toBeLessThan(
      text.findIndex((label) => label.includes("A100")),
    );
  });

  it("marks the ones the recipe names, and only those", async () => {
    const options = await renderOnGpuCluster("T4");
    const marked = (label: string) =>
      options
        .find((option) => option.textContent?.includes(label))
        ?.textContent?.includes("endpoints.recipe.verifiedAccelerator");

    expect(marked("T4")).toBe(true);
    expect(marked("A100")).toBe(false);
  });
});

// One section for what the deployment will weigh, reachable from both ways of
// getting here: the recipe section only exists when a recipe catalog is
// selected, and the model section is not rendered for an engine that needs no
// model spec, so neither could host it.
describe("the weights section is reachable from both modes", () => {
  it("estimates the KV cache with no catalog in play", async () => {
    setupMocks(
      [catalogA],
      [plainKubernetesCluster],
      [{ metadata: { name: "hf" } }],
    );
    render(<CreateForm />);

    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
      formInstance?.setValue("spec.model.name", "org/model");
      formInstance?.setValue("spec.model.info", { num_hidden_layers: 32 });
    });

    expect(screen.getByTestId("endpoint-weights-estimate")).toBeDefined();
    expect(screen.getByTestId("kv-cache-estimate")).toBeDefined();
    expect(screen.queryByTestId("endpoint-declared-weights")).toBeNull();
  });

  it("puts what the catalog declares beside the estimate", async () => {
    const withVram = {
      ...recipeCatalog,
      spec: {
        ...recipeCatalog.spec,
        variants: {
          default: {
            ...recipeCatalog.spec.variants.default,
            vram_minimum_gb: 48,
            model: {
              ...recipeCatalog.spec.variants.default.model,
              info: { parameter_count: "35B" },
            },
          },
        },
      },
    };
    setupMocks([catalogA, withVram], [plainKubernetesCluster]);
    render(<RecipeCreateForm />);
    selectCatalog("recipe-mc");

    const block = screen.getByTestId("endpoint-declared-weights");
    expect(within(block).getByText("35B")).toBeDefined();
    // The requirement travels with the check on it, in the same block.
    expect(within(block).getByTestId("vram-check-badge")).toBeDefined();
  });

  // Flex serves a model baked into its own image; there is no checkpoint to
  // compute a cache from. Checked with model info on the form, which an
  // existing spec can carry — otherwise the panel is absent for want of a
  // model rather than because the engine needs none.
  it("drops the estimate for an engine that needs no model spec", async () => {
    setupMocks(
      [],
      [],
      [{ metadata: { name: "hf" } }],
      [engineRef("flex"), engineRef("vllm")],
    );
    render(<CreateForm />);

    const withModelInfo = async () => {
      await act(async () => {
        formInstance?.setValue("spec.model.registry", "hf");
        formInstance?.setValue("spec.model.name", "org/model");
        formInstance?.setValue("spec.model.info", { num_hidden_layers: 32 });
      });
    };

    await act(async () => {
      formInstance?.setValue("spec.engine", { engine: "vllm", version: "v1" });
    });
    await withModelInfo();
    expect(screen.getByTestId("kv-cache-estimate")).toBeDefined();

    await act(async () => {
      formInstance?.setValue("spec.engine", { engine: "flex", version: "v1" });
    });
    await withModelInfo();
    expect(screen.queryByTestId("kv-cache-estimate")).toBeNull();
  });
});

// A catalog variant states the model's display metadata — parameter count,
// quantization — and not the shape the cache arithmetic needs. Picking a model
// fetches that shape onto the form, and the estimate has to use it.
describe("picking a model from a catalog feeds the estimate", () => {
  const displayOnlyCatalog = {
    ...recipeCatalog,
    spec: {
      ...recipeCatalog.spec,
      variants: {
        default: {
          ...recipeCatalog.spec.variants.default,
          model: {
            ...recipeCatalog.spec.variants.default.model,
            info: { parameter_count: "35B", quantization: "fp8" },
          },
        },
      },
    },
  };

  const checkpointShape = {
    num_hidden_layers: 32,
    num_key_value_heads: 8,
    head_dim: 128,
  };

  it("estimates from the checkpoint, not from the catalog's display metadata", async () => {
    setupMocks(
      [catalogA, displayOnlyCatalog],
      [plainKubernetesCluster],
      [{ metadata: { name: "hf" } }],
    );
    render(<RecipeCreateForm />);
    selectCatalog("recipe-mc");

    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
      formInstance?.setValue("spec.model.name", "org/model");
      formInstance?.setValue("spec.model.info", checkpointShape);
    });

    expect(
      screen.getByTestId("kv-cache-estimate").getAttribute("data-state"),
    ).not.toBe("missing-fields");
  });

  // The other direction: a catalog that does state the shape must still
  // estimate on its own, without anyone touching the model picker.
  it("estimates from what the catalog states when nothing is picked", () => {
    const shaped = {
      ...displayOnlyCatalog,
      spec: {
        ...displayOnlyCatalog.spec,
        variants: {
          default: {
            ...displayOnlyCatalog.spec.variants.default,
            model: {
              ...displayOnlyCatalog.spec.variants.default.model,
              info: { parameter_count: "35B", ...checkpointShape },
            },
          },
        },
      },
    };
    setupMocks([catalogA, shaped], [plainKubernetesCluster]);
    render(<RecipeCreateForm />);
    selectCatalog("recipe-mc");

    expect(
      screen.getByTestId("kv-cache-estimate").getAttribute("data-state"),
    ).not.toBe("missing-fields");
  });
});

// The estimate reads the form's copy of the model metadata, and that copy is
// submitted, so a catalog that states none has to clear what the last one left
// rather than inherit it.
describe("switching catalogs does not carry model metadata over", () => {
  const catalogNamed = (
    id: number,
    name: string,
    model: Record<string, unknown>,
  ) => ({
    id,
    metadata: { name },
    spec: {
      engine: { engine: "vllm", version: "0.8.5" },
      variants: { default: { model } },
    },
  });

  const baseModel = {
    version: "",
    registry: "hf",
    file: "",
    task: "text-generation",
  };

  it("clears it for a catalog that states none", () => {
    setupMocks(
      [
        catalogNamed(91, "with-info", {
          ...baseModel,
          name: "a",
          info: { parameter_count: "35B" },
        }),
        catalogNamed(92, "without-info", { ...baseModel, name: "b" }),
      ],
      [plainKubernetesCluster],
    );
    render(<RecipeCreateForm />);

    selectCatalog("with-info");
    expect(formInstance?.getValues().spec.model.info).toEqual({
      parameter_count: "35B",
    });

    selectCatalog("without-info");
    expect(formInstance?.getValues().spec.model.info).toBeNull();
  });

  it("replaces it for a catalog that states its own", () => {
    setupMocks(
      [
        catalogNamed(91, "first", {
          ...baseModel,
          name: "a",
          info: { parameter_count: "35B" },
        }),
        catalogNamed(92, "second", {
          ...baseModel,
          name: "b",
          info: { parameter_count: "8B" },
        }),
      ],
      [plainKubernetesCluster],
    );
    render(<RecipeCreateForm />);

    selectCatalog("first");
    selectCatalog("second");

    expect(formInstance?.getValues().spec.model.info).toEqual({
      parameter_count: "8B",
    });
  });
});

// Deploying from a recipe that exposes the context window as a feature put the
// same number on the page twice — once as the control that sets it, once as a
// field in the estimate — with no way to tell which one the deployment uses.
describe("a recipe's own controls are not offered twice", () => {
  const catalogWithContextFeature = {
    ...recipeCatalog,
    spec: {
      ...recipeCatalog.spec,
      variants: {
        default: {
          ...recipeCatalog.spec.variants.default,
          model: {
            ...recipeCatalog.spec.variants.default.model,
            info: {
              num_hidden_layers: 32,
              num_key_value_heads: 8,
              head_dim: 128,
            },
          },
        },
      },
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
    },
  };

  it("reads the context from the feature instead of offering a field", () => {
    setupMocks([catalogA, catalogWithContextFeature], [plainKubernetesCluster]);
    render(<RecipeCreateForm />);
    selectCatalog("recipe-mc");

    const tokens = screen.getByTestId("kv-cache-tokens");
    expect(tokens.tagName).not.toBe("INPUT");
    expect(tokens.getAttribute("data-owned-by")).toBe("Context window");
    expect(tokens.textContent).toBe("8,192");

    // Concurrency has no control on this catalog, so it stays a field.
    expect(screen.getByTestId("kv-cache-sequences").tagName).toBe("INPUT");
  });

  it("still offers both fields with no catalog in play", async () => {
    setupMocks(
      [catalogA],
      [plainKubernetesCluster],
      [{ metadata: { name: "hf" } }],
    );
    render(<CreateForm />);

    await act(async () => {
      formInstance?.setValue("spec.model.registry", "hf");
      formInstance?.setValue("spec.model.name", "org/model");
      formInstance?.setValue("spec.model.info", {
        num_hidden_layers: 32,
        num_key_value_heads: 8,
        head_dim: 128,
      });
    });

    expect(screen.getByTestId("kv-cache-tokens").tagName).toBe("INPUT");
    expect(screen.getByTestId("kv-cache-sequences").tagName).toBe("INPUT");
  });
});
