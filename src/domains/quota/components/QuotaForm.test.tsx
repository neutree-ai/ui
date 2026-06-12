import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// t() returns the key so we can assert on stable option labels.
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Use real react-hook-form, stripping refine-only options.
vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return rhf.useForm(rhfOpts);
    },
  };
});

// Controlled resource data for the three lookups the form performs.
vi.mock("@refinedev/core", () => ({
  useList: ({ resource }: { resource: string }) => {
    if (resource === "workspaces") {
      return { data: { data: [{ id: 1, metadata: { name: "default" } }] } };
    }
    if (resource === "user_profiles") {
      return {
        data: {
          data: [
            { id: "u1", spec: { email: "alice@example.com" } },
            { id: "u2", spec: { email: "bob@example.com" } },
          ],
        },
      };
    }
    if (resource === "api_keys") {
      return { data: { data: [{ id: "k1", metadata: { name: "key-A" } }] } };
    }
    return { data: { data: [] } };
  },
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  ALL_WORKSPACES: "_all_",
}));

import { QuotaForm } from "./QuotaForm";

function selectOption(fieldName: string, optionName: string) {
  const field = screen.getByTestId(`field-${fieldName}`);
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error(`combobox trigger not found for ${fieldName}`);
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

describe("QuotaForm", () => {
  it("bug1: workspace scope exposes a workspace selector defaulted to current", () => {
    render(<QuotaForm workspace="default" onSubmit={vi.fn()} />);
    const wsField = screen.getByTestId("field-workspace");
    expect(wsField).toBeTruthy();
    // The current workspace is pre-selected (trigger shows its name).
    expect(wsField.textContent).toContain("default");
  });

  it("bug2: user scope lists users", async () => {
    render(<QuotaForm workspace="default" onSubmit={vi.fn()} />);
    selectOption("level", "quota.levels.user");

    await waitFor(() => {
      expect(screen.getByTestId("field-target")).toBeTruthy();
    });
    const target = screen.getByTestId("field-target");
    const trigger = target.querySelector('button[role="combobox"]');
    fireEvent.click(trigger as Element);
    expect(
      screen.getByRole("option", { name: "alice@example.com" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "bob@example.com" })).toBeTruthy();
  });

  it("bug3: selected api key is retained across re-render and submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuotaForm workspace="default" onSubmit={onSubmit} />);

    selectOption("level", "quota.levels.api_key");
    await waitFor(() => {
      expect(screen.getByTestId("field-target")).toBeTruthy();
    });
    selectOption("target", "key-A");

    // The selected key shows in the trigger.
    expect(screen.getByTestId("field-target").textContent).toContain("key-A");

    // Re-render via an unrelated field change — previously this wiped target.
    const limit = screen
      .getByTestId("field-limit_tokens")
      .querySelector("input");
    fireEvent.change(limit as Element, { target: { value: "100" } });

    // Still selected.
    expect(screen.getByTestId("field-target").textContent).toContain("key-A");

    // Submit carries the api key id.
    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_limit_tokens: 100,
    });
  });
});
