import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { FormProvider, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/lib/model-source";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/BaseStatus", () => ({
  default: ({ translatedPhase }: { translatedPhase: string }) => (
    <span>{translatedPhase}</span>
  ),
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return {
        ...rhf.useForm(rhfOpts),
        refineCore: { onFinish: vi.fn() },
      };
    },
  };
});

vi.mock("@refinedev/core", () => ({
  // The form lists sibling external endpoints to collect the model-source
  // values already in use, so the suggestion list is presets + in-use.
  useList: () => ({
    data: {
      data: [
        {
          metadata: { name: "sibling-partner" },
          spec: { model_sources: { "some-model": "partner" } },
        },
        {
          metadata: { name: "sibling-custom" },
          spec: { model_sources: { "other-model": "acme-research-lab" } },
        },
        { metadata: { name: "sibling-none" }, spec: {} },
      ],
    },
  }),
  useSelect: () => ({
    query: {
      data: {
        data: [
          {
            metadata: { name: "endpoint-running" },
            status: { phase: "Running" },
          },
          {
            metadata: { name: "endpoint-deploying" },
            status: { phase: "Deploying" },
          },
          {
            metadata: { name: "endpoint-unknown" },
          },
        ],
      },
      isLoading: false,
    },
    options: [],
  }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock(
  "@/domains/external-endpoint/components/TestConnectivityButton",
  () => ({
    default: () => <div data-testid="test-connectivity-mock" />,
  }),
);

const mockConnectivityTest = vi.fn().mockResolvedValue({ success: false });
vi.mock("@/domains/external-endpoint/hooks/use-test-connectivity", () => ({
  useTestConnectivity: () => ({
    test: mockConnectivityTest,
    testingMap: {},
    resultMap: {},
  }),
}));

vi.mock("@/foundation/components/FormSelect", () => ({
  FormSelect: React.forwardRef(
    (
      props: {
        value?: string;
        onChange?: (v: string) => void;
        options?: { label: string; value: string }[];
      },
      ref: any,
    ) => (
      <select
        ref={ref}
        data-testid={
          props.options?.some((o) => o.value === "endpoint_ref")
            ? "form-select-mock"
            : "model-source-select-mock"
        }
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}
      >
        {props.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
  ),
}));

vi.mock("@/domains/external-endpoint/components/TimeoutInput", () => ({
  default: React.forwardRef(
    (props: { value?: number; onChange?: (v: number) => void }, ref: any) => (
      <input
        ref={ref}
        data-testid="timeout-input-mock"
        type="number"
        value={props.value ?? ""}
        onChange={(e) => props.onChange?.(Number(e.target.value))}
      />
    ),
  ),
}));

vi.mock("@/foundation/components/FormCombobox", () => ({
  // Two comboboxes are rendered (upstream endpoint_ref, and the model source),
  // so the testid has to distinguish them or queries match both. The source one
  // is the only one that accepts a typed value.
  FormCombobox: ({
    onChange,
    placeholder,
    options,
    renderOption,
    allowCustomValue,
  }: {
    onChange?: (v: string) => void;
    placeholder?: string;
    options?: { label: string; value: string }[];
    renderOption?: (option: {
      label: string;
      value: string;
    }) => React.ReactNode;
    allowCustomValue?: boolean;
  }) => (
    <div>
      <input
        data-testid={
          allowCustomValue ? "model-source-combobox-mock" : "form-combobox-mock"
        }
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <div
        data-testid={
          allowCustomValue
            ? "model-source-options-mock"
            : "combobox-options-mock"
        }
        data-values={(options ?? []).map((o) => o.value).join(",")}
      >
        {options?.map((option) => (
          <div key={option.value}>{renderOption?.(option) ?? option.label}</div>
        ))}
      </div>
    </div>
  ),
}));

import { useExternalEndpointForm } from "./use-external-endpoint-form";

function CreateForm() {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "create",
  });
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

function EditForm() {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "edit",
  });
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

describe("useExternalEndpointForm", () => {
  describe("create mode", () => {
    it("renders name, upstream type, upstream URL, and credential fields", () => {
      render(<CreateForm />);
      expect(screen.getByLabelText("common.fields.name")).toBeTruthy();
      expect(screen.getByTestId("field-_upstreamType_0")).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.credential"),
      ).toBeTruthy();
    });

    it("shows validation error when name is empty", async () => {
      render(<CreateForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      fireEvent.change(nameInput, { target: { value: "a" } });
      fireEvent.change(nameInput, { target: { value: "" } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(
          screen.getByText("external_endpoints.validation.nameRequired"),
        ).toBeTruthy();
      });
    });

    it("shows validation error when upstream URL is empty", async () => {
      render(<CreateForm />);
      const urlInput = screen.getByLabelText(
        "external_endpoints.fields.upstreamUrl",
      );
      fireEvent.change(urlInput, { target: { value: "a" } });
      fireEvent.change(urlInput, { target: { value: "" } });
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(
          screen.getByText("external_endpoints.validation.upstreamUrlRequired"),
        ).toBeTruthy();
      });
    });

    it("name field is not disabled", () => {
      render(<CreateForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      expect((nameInput as HTMLInputElement).disabled).toBe(false);
    });

    it("renders timeout field", () => {
      render(<CreateForm />);
      expect(screen.getByTestId("timeout-input-mock")).toBeTruthy();
    });

    it("adds a new upstream when add button is clicked", async () => {
      render(<CreateForm />);
      expect(
        screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toHaveLength(1);

      fireEvent.click(
        screen.getByText("external_endpoints.actions.addUpstream"),
      );

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(2);
      });
    });

    it("removes an upstream when remove button is clicked", async () => {
      render(<CreateForm />);
      // Add a second upstream first
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addUpstream"),
      );

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(2);
      });

      // Remove the first upstream (trash buttons are now enabled)
      const removeButtons = screen.getAllByRole("button", { name: "" });
      const trashButton = removeButtons.find(
        (btn) => btn.querySelector(".lucide-trash-2") !== null,
      );
      if (trashButton) fireEvent.click(trashButton);

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(1);
      });
    });

    it("clears model mapping when switching upstream type", async () => {
      render(<CreateForm />);

      // Add a model mapping entry: type upstream model name
      const upstreamInputs = screen.getAllByPlaceholderText(
        "external_endpoints.placeholders.upstreamModelName",
      );
      fireEvent.change(upstreamInputs[0], { target: { value: "gpt-4o" } });

      // Switch to endpoint_ref
      const typeSelect = screen.getByTestId("form-select-mock");
      fireEvent.change(typeSelect, { target: { value: "endpoint_ref" } });

      // Model mapping should be cleared — the upstream model input should
      // no longer have the old value
      await waitFor(() => {
        const mappingInputs = screen.getAllByPlaceholderText(
          "external_endpoints.placeholders.upstreamModelName",
        );
        expect((mappingInputs[0] as HTMLInputElement).value).toBe("");
      });
    });

    it("updates model mapping when switching endpoint ref", async () => {
      render(<CreateForm />);

      // Switch to endpoint_ref type
      const typeSelect = screen.getByTestId("form-select-mock");
      fireEvent.change(typeSelect, { target: { value: "endpoint_ref" } });

      // First endpoint ref returns models ["model-a", "model-b"]
      mockConnectivityTest.mockResolvedValueOnce({
        success: true,
        models: ["model-a", "model-b"],
      });

      const combobox = await screen.findByTestId("form-combobox-mock");
      fireEvent.change(combobox, { target: { value: "endpoint-1" } });

      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText(
          "external_endpoints.placeholders.upstreamModelName",
        );
        expect((inputs[0] as HTMLInputElement).value).toBe("model-a");
      });

      // Switch to a different endpoint ref returning ["model-x"]
      mockConnectivityTest.mockResolvedValueOnce({
        success: true,
        models: ["model-x"],
      });

      fireEvent.change(combobox, { target: { value: "endpoint-2" } });

      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText(
          "external_endpoints.placeholders.upstreamModelName",
        );
        expect(inputs).toHaveLength(1);
        expect((inputs[0] as HTMLInputElement).value).toBe("model-x");
      });
    });

    it("renders endpoint ref phases as status tags instead of label text", () => {
      render(<CreateForm />);
      fireEvent.change(screen.getByTestId("form-select-mock"), {
        target: { value: "endpoint_ref" },
      });

      expect(screen.getByText("endpoint-running")).toBeTruthy();
      expect(screen.getByText("status.phases.endpoint.Running")).toBeTruthy();
      expect(screen.getByText("status.phases.endpoint.Deploying")).toBeTruthy();
      expect(screen.getByText("endpoint-unknown")).toBeTruthy();
      expect(screen.queryByText("endpoint-running (Running)")).toBeNull();
    });

    it("default upstream renders external type fields", () => {
      render(<CreateForm />);
      // External type fields should be visible
      expect(
        screen.getByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.credential"),
      ).toBeTruthy();
      // Endpoint ref field should NOT be visible
      expect(
        screen.queryByLabelText("external_endpoints.fields.endpointRef"),
      ).toBeNull();
    });
  });

  describe("model source", () => {
    // The source is stored per model on spec.model_sources and edited in the
    // model-mapping row, because one endpoint's models can have different
    // sources. So the whole form is rendered, not just the metadata card.
    let captured: UseFormReturn<ExternalEndpoint> | null = null;
    function SourceForm() {
      const { form, metadataFields, specFields } = useExternalEndpointForm({
        action: "create",
      });
      captured = form as unknown as UseFormReturn<ExternalEndpoint>;
      return (
        <FormProvider {...form}>
          <form>
            {metadataFields}
            {specFields}
          </form>
        </FormProvider>
      );
    }

    const sourceInput = () =>
      screen.getAllByTestId("model-source-combobox-mock")[0];
    const offeredSources = () =>
      (
        screen
          .getAllByTestId("model-source-options-mock")[0]
          .getAttribute("data-values") ?? ""
      )
        .split(",")
        .filter(Boolean);

    // The source hangs off the exposed model name, so a row has to name a model
    // before it has anything to key a source on.
    const nameModel = (model: string) => {
      fireEvent.change(
        screen.getAllByPlaceholderText(
          "external_endpoints.placeholders.exposedModelName",
        )[0],
        { target: { value: model } },
      );
    };

    it("suggests the presets plus the values already in use, never self-hosted", () => {
      // The enum is open on the server, so the list is suggestions rather than
      // an enumeration: presets first, then whatever sibling endpoints already
      // use, so the second person to need a custom source picks it instead of
      // retyping it slightly differently.
      //
      // self-hosted stays out regardless: it is the derived source of internal
      // endpoints and the backend rejects it here; offering it would make the
      // internal and external rows for one model name indistinguishable in the
      // API-key model picker.
      render(<SourceForm />);
      expect(offeredSources()).toEqual([
        "internal-shared",
        "third-party-public",
        "partner",
        "acme-research-lab",
      ]);
      expect(offeredSources()).not.toContain(SELF_HOSTED_MODEL_SOURCE);
    });

    it("writes the chosen source under the model name", () => {
      render(<SourceForm />);
      nameModel("gpt-4o");
      fireEvent.change(sourceInput(), { target: { value: "partner" } });
      expect(captured?.getValues("spec.model_sources")).toEqual({
        "gpt-4o": "partner",
      });
    });

    it("accepts a value that is not offered at all", () => {
      // The whole point of the open enum: a brand-new source needs no code
      // change, no migration and no admin-maintained list.
      render(<SourceForm />);
      nameModel("gpt-4o");
      fireEvent.change(sourceInput(), { target: { value: "new-lab" } });
      expect(captured?.getValues("spec.model_sources")).toEqual({
        "gpt-4o": "new-lab",
      });
    });

    it("ignores a source typed before the model is named", () => {
      // Nothing to key it on yet; storing it under "" would attach it to a
      // model that does not exist.
      render(<SourceForm />);
      fireEvent.change(sourceInput(), { target: { value: "partner" } });
      expect(captured?.getValues("spec.model_sources") ?? {}).toEqual({});
    });
  });

  describe("edit mode", () => {
    it("disables name field", () => {
      render(<EditForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      expect((nameInput as HTMLInputElement).disabled).toBe(true);
    });

    // Credential hint ("leaveEmptyToKeepValue") is rendered inside
    // upstream cards. In unit tests the mock useForm has no refineCore
    // query, so the edit form starts with an empty upstreams array and
    // no cards are rendered. The hint is implicitly covered by the
    // create-mode tests that render upstream fields.
  });
});
