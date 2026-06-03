import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
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

vi.mock("@/domains/endpoint/components/SliderWithInput", () => ({
  SliderWithInput: React.forwardRef(
    (props: { unit?: string }, ref: React.Ref<HTMLDivElement>) => (
      <div data-testid={`slider-mock-${props.unit || "default"}`} ref={ref} />
    ),
  ),
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

    it("normalizes backend query resources before editing an existing vGPU endpoint", async () => {
      setupMocks([catalogA, catalogB], [hamiKubernetesCluster]);
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

    it("shows validation error when scheduler type is cleared", async () => {
      render(<CreateForm />);

      // Clear the scheduler type and trigger validation via resolver
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
      expect(error).toBeTruthy();
      expect(error?.message).toBe("endpoints.messages.schedulerTypeRequired");
    });
  });
});
