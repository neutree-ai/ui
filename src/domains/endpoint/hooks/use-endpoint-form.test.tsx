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
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      const form = rhf.useForm(rhfOpts);
      (form as Record<string, unknown>).refineCore = {
        onFinish: vi.fn(),
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
import { useEndpointForm } from "./use-endpoint-form";

// --- Fixtures ---

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

const defaultSelectResult = {
  query: { data: { data: [] }, isLoading: false },
};

function setupMocks(catalogs = [catalogA, catalogB]) {
  vi.mocked(useSelect).mockImplementation(((opts: { resource: string }) => {
    if (opts.resource === "model_catalogs") {
      return { query: { data: { data: catalogs }, isLoading: false } };
    }
    return defaultSelectResult;
  }) as never);

  vi.mocked(useCustom).mockReturnValue({
    data: null,
    isFetching: false,
  } as never);
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
        {result.modelFields}
        {result.engineFields}
        {result.deploymentModeFields}
        {result.resourceFields}
        {result.roleFields}
        {result.kvFields}
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
        {result.modelFields}
        {result.engineFields}
        {result.deploymentModeFields}
        {result.resourceFields}
        {result.roleFields}
        {result.kvFields}
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

function section(title: string) {
  const card = screen.getByText(title).closest("[class*='shadow-sm']");
  if (!card) throw new Error(`section ${title} not found`);
  return card as HTMLElement;
}

// --- Tests ---

describe("useEndpointForm", () => {
  beforeEach(() => {
    setupMocks();
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

    it("create mode shows model runtime fields in the main flow", () => {
      render(<CreateForm />);
      expect(screen.getByTestId("field-spec.model.name")).toBeTruthy();
      expect(screen.getByTestId("field-spec.engine.engine")).toBeTruthy();
      expect(screen.getByTestId("field-spec.engine.version")).toBeTruthy();
      expect(screen.getByTestId("field-spec.model.task")).toBeTruthy();
    });

    it("renders model and engine settings as standalone sections before deployment mode", () => {
      render(<CreateForm />);

      const templateSection = section("endpoints.sections.templateSelection");
      const modelSection = section("endpoints.sections.modelSettings");
      const engineSection = section("endpoints.sections.engineSettings");
      const deploymentSection = section("endpoints.sections.deploymentMode");

      expect(
        templateSection.compareDocumentPosition(modelSection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        modelSection.compareDocumentPosition(engineSection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        engineSection.compareDocumentPosition(deploymentSection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      expect(
        within(templateSection).queryByTestId("field-spec.model.name"),
      ).toBeNull();
      expect(
        within(templateSection).queryByTestId("field-spec.engine.engine"),
      ).toBeNull();
      expect(
        within(modelSection).getByTestId("field-spec.model.registry"),
      ).toBeTruthy();
      expect(
        within(modelSection).getByTestId("field-spec.model.name"),
      ).toBeTruthy();
      expect(
        within(modelSection).getByTestId("field-spec.model.version"),
      ).toBeTruthy();
      expect(
        within(modelSection).getByTestId("field-spec.model.file"),
      ).toBeTruthy();
      expect(
        within(engineSection).getByTestId("field-spec.engine.engine"),
      ).toBeTruthy();
      expect(
        within(engineSection).getByTestId("field-spec.engine.version"),
      ).toBeTruthy();
      expect(
        within(engineSection).getByTestId("field-spec.model.task"),
      ).toBeTruthy();
    });
  });

  describe("deployment mode", () => {
    it("defaults to standard mode", () => {
      render(<CreateForm />);

      expect(formInstance?.getValues("spec.strategy")).toBe("");
      expect(screen.getByTestId("field-spec.resources.cpu")).toBeTruthy();
      expect(
        screen.queryByTestId("field-spec.roles.0.replicas.num"),
      ).toBeNull();
      expect(
        screen.queryByTestId("field-spec.kv.transfer.connector"),
      ).toBeNull();
    });

    it("switches to prefill/decode mode and hides global resource controls", () => {
      render(<CreateForm />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "endpoints.deploymentModes.prefillDecode",
        }),
      );

      expect(formInstance?.getValues("spec.strategy")).toBe("pd");
      expect(formInstance?.getValues("spec.placement.roles")).toBe("same-host");
      expect(formInstance?.getValues("spec.replicas.num")).toBe(1);
      expect(screen.queryByTestId("field-spec.resources.cpu")).toBeNull();
      expect(screen.queryByTestId("field-spec.replicas.num")).toBeNull();
      expect(screen.getByText("endpoints.fields.replicas")).toBeTruthy();
      expect(
        screen.getByTestId("field-spec.roles.0.replicas.num"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("field-spec.kv.transfer.connector"),
      ).toBeTruthy();
      expect(formInstance?.getValues("spec.kv.transfer.connector")).toBe(
        "nixl",
      );

      const connectorTrigger = screen
        .getByTestId("field-spec.kv.transfer.connector")
        .querySelector('button[role="combobox"]');
      if (!connectorTrigger) throw new Error("connector trigger not found");
      fireEvent.click(connectorTrigger);
      expect(screen.getByRole("option", { name: "mooncake" })).toBeTruthy();
    });

    it("shows independent decode role settings in prefill/decode mode", async () => {
      render(<CreateForm />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "endpoints.deploymentModes.prefillDecode",
        }),
      );
      fireEvent.mouseDown(
        screen.getByRole("tab", { name: "endpoints.roles.decode" }),
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("field-spec.roles.1.replicas.num"),
        ).toBeTruthy();
      });
      expect(
        screen.queryByTestId("field-spec.roles.0.replicas.num"),
      ).toBeNull();
      expect(
        screen.getByTestId("field-spec.roles.1.resources.cpu"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("field-spec.roles.1.variables.engine_args"),
      ).toBeTruthy();
      expect(screen.getByTestId("field-spec.roles.1.env")).toBeTruthy();
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
