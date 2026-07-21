import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

// cmdk (used by FormCombobox) observes its list on mount; jsdom has no
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

import { apiKeyPolicyDefaults } from "@/domains/api-key/hooks/use-api-key-policy";
import { TokenQuotaField } from "./TokenQuotaField";

function Harness() {
  const form = useForm({ mode: "all", defaultValues: apiKeyPolicyDefaults() });
  return (
    <FormProvider {...form}>
      <form>
        <TokenQuotaField form={form} />
      </form>
    </FormProvider>
  );
}

const amountInput = () =>
  screen.getByLabelText("api_keys.limits.tokenLimit") as HTMLInputElement;

// Open the unit Select (second combobox) and pick a unit by its label.
function selectUnit(unitLabel: string) {
  const unitField = screen.getByTestId("field-quota_unit");
  const trigger = unitField.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("unit trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: unitLabel }));
}

describe("TokenQuotaField", () => {
  it("groups digits with thousands separators as you type", () => {
    render(<Harness />);
    fireEvent.change(amountInput(), { target: { value: "10000" } });
    expect(amountInput().value).toBe("10,000");
  });

  it("revalidates the amount when the unit changes", async () => {
    render(<Harness />);
    // Default unit is M, where 1.5 is legal (1,500,000) — no error.
    fireEvent.change(amountInput(), { target: { value: "1.5" } });
    fireEvent.blur(amountInput());
    await waitFor(() => {
      expect(
        screen.queryByText("api_keys.limits.invalidTokenQuota"),
      ).toBeNull();
    });

    // Switch to Tokens: 1.5 tokens is illegal, and the error must appear
    // without touching the amount field again (this is what the deps rule buys).
    selectUnit("api_keys.limits.units.tokens");
    await waitFor(() => {
      expect(
        screen.getByText("api_keys.limits.invalidTokenQuota"),
      ).toBeTruthy();
    });

    // Switch back to M: the amount becomes legal again, error clears.
    selectUnit("api_keys.limits.units.M");
    await waitFor(() => {
      expect(
        screen.queryByText("api_keys.limits.invalidTokenQuota"),
      ).toBeNull();
    });
  });
});
