import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

// cmdk (used by the comboboxes) observes its list on mount; jsdom has no
// ResizeObserver, so stub it before rendering.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = () => {};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The picker is exercised by its own tests; here it only has to not need a
// workspace listing.
vi.mock("@/domains/api-key/components/ModelMultiSelect", () => ({
  ModelMultiSelect: () => <div>picker</div>,
}));

vi.mock(
  "@/domains/api-key/hooks/use-api-key-policy",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/domains/api-key/hooks/use-api-key-policy")
      >();
    return {
      ...actual,
      // One external option, so a row matching it can be shown with the source
      // the workspace actually reports rather than one guessed from its side.
      useWorkspaceModels: () => [
        {
          value: "external:ep-vendor:gpt-4o",
          label: "gpt-4o",
          model: "gpt-4o",
          endpointName: "ep-vendor",
          type: "external" as const,
          source: "third-party-public",
          phase: "Running",
        },
      ],
    };
  },
);

import {
  apiKeyPolicyDefaults,
  type PolicyModelRow,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { ApiKeyPolicyFields } from "./ApiKeyPolicyFields";

const pinned = (model: string, endpoint: string): PolicyModelRow => ({
  value: `external:${endpoint}:${model}`,
  model,
  type: "external",
  endpoint_name: endpoint,
});

function Harness({ models = [] as PolicyModelRow[] }) {
  const form = useForm({
    mode: "all",
    defaultValues: { ...apiKeyPolicyDefaults(), models },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <ApiKeyPolicyFields form={form} workspace="default" />
        <button type="submit">submit</button>
      </form>
    </FormProvider>
  );
}

const overallAmount = () =>
  screen.getByLabelText("api_keys.limits.tokenLimit") as HTMLInputElement;
// `t` is stubbed to return the bare key, so every row's limit input shares one
// accessible name; index into them rather than naming a model.
const modelLimits = () =>
  screen.getAllByLabelText(
    "api_keys.limits.perModel.limitLabel",
  ) as HTMLInputElement[];

describe("ApiKeyPolicyFields", () => {
  it("offers only the overall quota while the allowlist is empty", () => {
    render(<Harness />);
    expect(
      screen.getByText("api_keys.limits.perModel.emptyAllowlist"),
    ).toBeTruthy();
    expect(overallAmount().disabled).toBe(false);
  });

  it("suspends the overall quota as soon as a model carries a limit, and restores it when cleared", async () => {
    render(<Harness models={[pinned("gpt-4o", "openai")]} />);
    expect(overallAmount().disabled).toBe(false);

    fireEvent.change(modelLimits()[0], { target: { value: "2" } });
    await waitFor(() => {
      expect(overallAmount().disabled).toBe(true);
    });
    expect(
      screen.getByText("api_keys.limits.perModel.overallSuspended"),
    ).toBeTruthy();

    fireEvent.change(modelLimits()[0], { target: { value: "" } });
    await waitFor(() => {
      expect(overallAmount().disabled).toBe(false);
    });
  });

  it("flags overlapping entries for a model once one of them has a limit", async () => {
    render(
      <Harness
        models={[
          pinned("gpt-4o", "openai"),
          { value: "gpt-4o", model: "gpt-4o", wildcard: true },
        ]}
      />,
    );
    // No limit anywhere yet: a migrated any-source entry alongside a pinned one
    // is legal and must not be flagged.
    expect(screen.queryByText("api_keys.limits.perModel.overlap")).toBeNull();

    fireEvent.change(modelLimits()[0], { target: { value: "2" } });
    await waitFor(() => {
      expect(
        screen.getAllByText("api_keys.limits.perModel.overlap").length,
      ).toBe(2);
    });

    // And the form refuses to submit rather than letting the backend reject it.
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() => {
      expect(
        screen.getByText("api_keys.limits.perModel.overlapError"),
      ).toBeTruthy();
    });
  });
});

describe("model source on the allowlist rows", () => {
  it("shows the workspace's source for an external row, not Unspecified", () => {
    // The source belongs to the model. Deriving it from the row's IE/EE side
    // yields nothing for every external row, which is what made the detail page
    // read "Unspecified" for models that had a source set.
    render(
      <Harness
        models={[
          {
            value: "external:ep-vendor:gpt-4o",
            model: "gpt-4o",
            type: "external",
            endpoint_name: "ep-vendor",
          },
        ]}
      />,
    );

    expect(
      screen.getByText("modelSource.values.third-party-public"),
    ).toBeTruthy();
  });
});
