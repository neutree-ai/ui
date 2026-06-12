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
      (form as Record<string, unknown>).refineCore = {
        onFinish: refineCoreOnFinishMock,
        query: queryDataRef.current
          ? { data: { data: queryDataRef.current } }
          : undefined,
      };
      return form;
    },
  };
});

vi.mock("@refinedev/core", () => ({
  useSelect: vi.fn(),
  useCustom: vi.fn(),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

vi.mock("@/foundation/components/VariablesInput", () => ({
  VariablesInput: React.forwardRef(
    (_props: unknown, ref: React.Ref<HTMLDivElement>) => (
      <div data-testid="variables-input-mock" ref={ref} />
    ),
  ),
}));

import { useCustom, useSelect } from "@refinedev/core";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
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

// --- Mocks setup ---

const plainKubernetesCluster = {
  metadata: metadata("plain-k8s"),
  spec: { type: "kubernetes" },
  status: { resource_info: null },
} satisfies EndpointClusterRef;

const hamiKubernetesCluster = {
  metadata: metadata("hami-k8s"),
  spec: {
    type: "kubernetes",
    accelerator_virtualization: { enabled: true },
  },
  status: { resource_info: null },
} satisfies EndpointClusterRef;

const hamiKubernetesClusterWithDevices = {
  metadata: metadata("hami-k8s-devices"),
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
      },
    },
  },
} satisfies EndpointClusterRef;

const defaultSelectResult = {
  query: { data: { data: [] }, isLoading: false },
};

function setupMocks(
  catalogs = [catalogA, catalogB],
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

  vi.mocked(useCustom).mockReturnValue({
    data: null,
    isFetching: false,
  } as unknown as ReturnType<typeof useCustom>);
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

  it("places cluster-only scheduling target inside resource selection", async () => {
    setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
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
    expect(
      within(schedulingTarget).getByTestId("field-spec.cluster"),
    ).toBeTruthy();
    expect(
      within(schedulingTarget).queryByTestId("field--scheduling-scope"),
    ).toBeNull();
    expect(
      within(schedulingTarget).getAllByText(
        "endpoints.descriptions.clusterSchedulingTarget",
      ).length,
    ).toBeGreaterThan(0);

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
    setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
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
    expect(screen.getByTestId("field--model-catalog").className).toContain(
      "col-span-1",
    );
  });

  it("renders resource inputs in the PRD order", async () => {
    setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
    render(<CreateForm />);

    await waitFor(() => expect(formInstance).not.toBeNull());

    act(() => {
      formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
    setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => {
        expect(
          formInstance?.getValues(
            "spec.resources.accelerator.virtualization.memory_mib",
          ),
        ).toBe(8192);
      });

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
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
          metadata: metadata("hami-endpoint"),
          spec: {
            cluster: "hami-k8s",
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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

    it("renders percent-backed virtual memory as GiB and edits it as MiB", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_percent: 50,
            core_percent: 0,
          },
        });
      });

      expect(await screen.findByDisplayValue("7.5")).toBeTruthy();

      const memoryInput = screen.getByRole("spinbutton", {
        name: /endpoints.fields.singleCardMemory/i,
      });
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
        formInstance?.setValue("spec.resources.accelerator", {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        });
      });

      expect(
        screen.getByText("endpoints.descriptions.vgpuCorePercentZero"),
      ).toBeTruthy();

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

    it("renders configured core limit when editing a vGPU endpoint", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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

    it("validates vGPU memory input changes immediately", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
          screen.getByText("endpoints.messages.vgpuMemoryMiBPositive"),
        ).toBeTruthy();
      });
    });

    it("shows linked cluster and node GPU resources inline in the resource panel", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
      expect(
        panel.getByTestId("endpoint-cluster-resource-summary"),
      ).toBeTruthy();
      expect(panel.getByTestId("endpoint-compact-node-resources")).toBeTruthy();
      expect(panel.getAllByTestId("endpoint-compact-node-card").length).toBe(2);
      expect(panel.queryByTestId("endpoint-resource-toolbar")).toBeNull();
      expect(panel.getByText("common.fields.cpu")).toBeTruthy();
      expect(panel.getByText("common.fields.memory")).toBeTruthy();
      expect(panel.queryByText("endpoints.sections.currentRequest")).toBeNull();
      expect(panel.queryByRole("table")).toBeNull();
      expect(panel.queryByRole("combobox")).toBeNull();
      expect(panel.queryByText("clusters.options.summary")).toBeNull();
      expect(panel.queryByText("clusters.options.nodes")).toBeNull();
      expect(panel.queryByText("clusters.options.table")).toBeNull();
      const clusterSection = panel.getByTestId(
        "endpoint-cluster-resource-summary",
      );
      const nodeSection = panel.getByTestId("endpoint-compact-node-resources");
      expect(
        clusterSection.compareDocumentPosition(nodeSection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getAllByText("Tesla-T4").length).toBeGreaterThan(0);
      expect(screen.queryByText("clusters.fields.vgpuMemoryUsage")).toBeNull();

      expect(
        await screen.findAllByText("15360.0 / 30720.0 MiB"),
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText((text) => text.includes("50.0 / 200.0")).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText((text) =>
          text.includes("common.fields.cpu 12.0 / 16.0 cores"),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText((text) =>
          text.includes("common.fields.memory 48.0 / 64.0 GiB"),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText("7680.0 / 15360.0 MiB").length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText((text) => text.includes("50.0 / 100.0")).length,
      ).toBeGreaterThan(0);
      expect(
        panel.getAllByText((text) => text.includes("clusters.options.usable"))
          .length,
      ).toBeGreaterThan(0);
      expect(
        panel.getByRole("button", {
          name: /clusters\.fields\.gpuNumber 1, clusters\.fields\.deviceUuid/,
        }),
      ).toBeTruthy();
      expect(
        panel.getByRole("button", {
          name: /clusters\.fields\.gpuNumber 2, clusters\.fields\.deviceUuid/,
        }),
      ).toBeTruthy();

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
        expect(getAcceleratorCardText()).toContain(
          "endpoints.fields.physicalGpu: 2.0 / 0.0",
        );
        expect(getAcceleratorCardText()).toContain(
          "endpoints.messages.fullGpuResourcesInsufficient",
        );
      });
    });

    it("uses the productized resource configuration layout", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
      expect(
        resourceContextPanel.getByText("endpoints.fields.physicalGpu"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getByTestId("endpoint-cluster-resource-summary"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getByTestId("endpoint-compact-node-resources"),
      ).toBeTruthy();
      expect(
        resourceContextPanel.getAllByText("clusters.fields.memoryUsage").length,
      ).toBeGreaterThan(0);
      expect(
        resourceContextPanel.getAllByText("clusters.fields.coreUsage").length,
      ).toBeGreaterThan(0);
      expect(resourceContextPanel.getByText("common.fields.cpu")).toBeTruthy();
      expect(
        resourceContextPanel.getByText("common.fields.memory"),
      ).toBeTruthy();
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
      ).toContain("xl:grid-cols-2");
      expect(screen.getByTestId("endpoint-resource-config-main")).toBeTruthy();
      expect(resourceContext).toBeTruthy();
      expect(
        screen.getByText("endpoints.sections.currentRequest"),
      ).toBeTruthy();
      expect(getAcceleratorCardText()).toContain("endpoints.fields.vgpuSlices");
      expect(
        within(acceleratorCard).getByTestId(
          "endpoint-accelerator-allocator-row",
        ),
      ).toBeTruthy();
      const requestGrid = screen.getByTestId("endpoint-resource-request-grid");
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
      expect(screen.queryByTestId("slider-input")).toBeNull();
    });

    it("shows vGPU slice capacity warnings in the edit resource form", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
        expect(getAcceleratorCardText()).toContain(
          "endpoints.fields.vgpuSlices",
        );
      });
      expect(getAcceleratorCardText()).toContain(
        "endpoints.fields.vgpuSlices: 4.0 / 1.0",
      );
      expect(getAcceleratorCardText()).toContain(
        "endpoints.messages.vgpuResourcesInsufficient",
      );
    });

    it("shows full-card capacity warnings when requested cards exceed availability", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<CreateForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
    });

    it("checks only additional full cards while editing an existing endpoint", async () => {
      queryDataRef.current = {
        metadata: metadata("hami-existing-full-gpu"),
        spec: {
          cluster: "hami-k8s-devices",
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
        metadata: metadata("hami-existing-full-gpu"),
        spec: {
          cluster: "hami-k8s-devices",
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
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
          "endpoints.fields.physicalGpu: 1.0 / 1.0",
        );
      });
      expect(
        screen.queryByText("endpoints.messages.fullGpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("adds the current endpoint vGPU allocation back while editing", async () => {
      queryDataRef.current = {
        metadata: metadata("hami-existing-vgpu"),
        spec: {
          cluster: "hami-k8s-devices",
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
                instance_id: "hami-existing-vgpu-abc",
                replica_id: "hami-existing-vgpu-abc",
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
      setupMocks([catalogA, catalogB], [hamiKubernetesClusterWithDevices]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s-devices");
        formInstance?.setValue("spec.replicas.num", 1);
      });

      await waitFor(() => {
        expect(getAcceleratorCardText()).toContain(
          "endpoints.fields.vgpuSlices",
        );
      });
      expect(getAcceleratorCardText()).toContain(
        "endpoints.fields.vgpuSlices: 1.0 / 1.0",
      );
      expect(
        screen.queryByText("endpoints.messages.vgpuResourcesInsufficient"),
      ).toBeNull();
    });

    it("switches allocation mode by clearing or setting single-card memory", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesCluster]);
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("spec.cluster", "hami-k8s");
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
        expect(getAcceleratorCardText()).toContain(
          "endpoints.fields.vgpuSlices",
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
        expect(screen.queryByText(/endpoints\.fields\.vgpuSlices/)).toBeNull();
        expect(
          screen.getByText("endpoints.fields.physicalGpu: 1.0 / 0.0"),
        ).toBeTruthy();
        expect(
          formInstance?.getValues("spec.resources.accelerator.virtualization"),
        ).toBeUndefined();
      });

      fireEvent.focus(memoryInput);
      fireEvent.change(memoryInput, { target: { value: "8" } });

      await waitFor(() => {
        expect(getAcceleratorCardText()).toContain(
          "endpoints.fields.vgpuSlices",
        );
      });
      expect(
        formInstance?.getValues(
          "spec.resources.accelerator.virtualization.memory_mib",
        ),
      ).toBe(8192);
    });
  });

  describe("submit transform", () => {
    it("submits backend-compatible flat vGPU resource keys", async () => {
      render(<EditForm />);

      await waitFor(() => expect(formInstance).not.toBeNull());

      act(() => {
        formInstance?.setValue("metadata.name", "hami-endpoint");
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
});
