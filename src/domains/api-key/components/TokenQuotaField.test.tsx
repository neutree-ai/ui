import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { apiKeyPolicyDefaults } from "@/domains/api-key/hooks/use-api-key-policy";
import { selectOption } from "@/foundation/testing/interactions";
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
    selectOption("quota_unit", "api_keys.limits.units.tokens");
    await screen.findByText("api_keys.limits.invalidTokenQuota");

    // Switch back to M: the amount becomes legal again, error clears.
    selectOption("quota_unit", "api_keys.limits.units.M");
    await waitFor(() => {
      expect(
        screen.queryByText("api_keys.limits.invalidTokenQuota"),
      ).toBeNull();
    });
  });
});
