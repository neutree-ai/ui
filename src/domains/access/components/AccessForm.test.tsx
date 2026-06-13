import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// cmdk and Radix components use APIs missing from jsdom.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

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

// Controlled resource data for the lookups the form performs.
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

import { AccessForm } from "./AccessForm";

function selectOption(fieldName: string, optionName: string) {
  const field = screen.getByTestId(`field-${fieldName}`);
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error(`combobox trigger not found for ${fieldName}`);
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

function setInput(fieldName: string, value: string) {
  const input = screen.getByTestId(`field-${fieldName}`).querySelector("input");
  fireEvent.change(input as Element, { target: { value } });
}

describe("AccessForm", () => {
  it("workspace scope exposes a workspace selector defaulted to current", () => {
    render(<AccessForm workspace="default" onSubmit={vi.fn()} />);
    const wsField = screen.getByTestId("field-workspace");
    expect(wsField).toBeTruthy();
    expect(wsField.textContent).toContain("default");
  });

  it("user scope lists users", async () => {
    render(<AccessForm workspace="default" onSubmit={vi.fn()} />);
    selectOption("level", "access.levels.user");
    await waitFor(() => {
      expect(screen.getByTestId("field-target")).toBeTruthy();
    });
    const target = screen.getByTestId("field-target");
    fireEvent.click(target.querySelector('button[role="combobox"]') as Element);
    expect(
      screen.getByRole("option", { name: "alice@example.com" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "bob@example.com" })).toBeTruthy();
  });

  it("api key is retained across re-render and a rate_limit rule is submitted", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AccessForm workspace="default" onSubmit={onSubmit} />);

    selectOption("level", "access.levels.api_key");
    await waitFor(() => {
      expect(screen.getByTestId("field-target")).toBeTruthy();
    });
    selectOption("target", "key-A");
    expect(screen.getByTestId("field-target").textContent).toContain("key-A");

    // Unrelated field change previously could wipe target.
    setInput("limit", "100");
    expect(screen.getByTestId("field-target").textContent).toContain("key-A");

    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "rate_limit",
      p_rule_spec: { limit: 100, window: "minute" },
    });
  });

  it("concurrency rule submits a max in rule_spec", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AccessForm workspace="default" onSubmit={onSubmit} />);

    // workspace level (default). Switch the rule type to concurrency.
    selectOption("rule_type", "access.ruleTypes.concurrency");
    await waitFor(() => {
      expect(screen.getByTestId("field-max")).toBeTruthy();
    });
    setInput("max", "8");

    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      p_level: "workspace",
      p_workspace: "default",
      p_rule_type: "concurrency",
      p_rule_spec: { max: 8 },
    });
  });
});
