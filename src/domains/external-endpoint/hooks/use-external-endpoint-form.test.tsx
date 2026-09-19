import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { FormProvider, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import {
  MODEL_SOURCE_LABEL_KEY,
  SELF_HOSTED_MODEL_SOURCE,
} from "@/foundation/lib/model-source";

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
  FormCombobox: ({
    onChange,
    placeholder,
    options,
    renderOption,
  }: {
    onChange?: (v: string) => void;
    placeholder?: string;
    options?: { label: string; value: string }[];
    renderOption?: (option: {
      label: string;
      value: string;
    }) => React.ReactNode;
  }) => (
    <div>
      <input
        data-testid="form-combobox-mock"
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {options?.map((option) => (
        <div key={option.value}>{renderOption?.(option) ?? option.label}</div>
      ))}
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

  describe("model source label", () => {
    // The label is stored under a key containing dots and a slash, which
    // react-hook-form would read as a nested path, so the field writes the
    // whole labels map instead of registering a path.
    let captured: UseFormReturn<ExternalEndpoint> | null = null;
    function SourceForm() {
      const { form, metadataFields } = useExternalEndpointForm({
        action: "create",
      });
      captured = form as unknown as UseFormReturn<ExternalEndpoint>;
      return (
        <FormProvider {...form}>
          <form>{metadataFields}</form>
        </FormProvider>
      );
    }

    const sourceSelect = () =>
      screen.getByTestId("model-source-select-mock") as HTMLSelectElement;

    it("offers every preset source except self-hosted", () => {
      // self-hosted is the derived source of internal endpoints and the
      // backend rejects it here; offering it would make the internal and
      // external rows for one model name indistinguishable in the API-key
      // model picker.
      render(<SourceForm />);
      const values = Array.from(sourceSelect().options).map((o) => o.value);
      expect(values).toEqual([
        "internal-shared",
        "third-party-public",
        "partner",
      ]);
      expect(values).not.toContain(SELF_HOSTED_MODEL_SOURCE);
    });

    it("writes the chosen source into metadata.labels", () => {
      render(<SourceForm />);
      fireEvent.change(sourceSelect(), { target: { value: "partner" } });
      expect(captured?.getValues("metadata.labels")).toEqual({
        [MODEL_SOURCE_LABEL_KEY]: "partner",
      });
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
