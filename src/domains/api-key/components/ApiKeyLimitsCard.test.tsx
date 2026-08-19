import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();
const load = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync }),
  useInvalidate: () => invalidate,
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const form =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return { useForm: form.useForm };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/domains/api-key/components/ApiKeyPolicyFields", () => ({
  ApiKeyPolicyFields: () => <div>Policy fields</div>,
}));

vi.mock("@/domains/api-key/components/ProjectPicker", () => ({
  ProjectPicker: ({ value }: { value: string }) => (
    <div data-testid="project-picker">{value}</div>
  ),
}));

vi.mock("@/domains/api-key/hooks/use-api-key-policy", () => ({
  QUOTA_PERIODS: ["monthly"],
  apiKeyPolicyDefaults: () => ({}),
  buildApiKeyLimits: () => ({ rps: 10 }),
  limitsToForm: () => ({}),
  useApiKeyDisable: () => ({ disable: vi.fn(), enable: vi.fn() }),
  useApiKeyLimits: () => ({ load }),
}));

import { ApiKeyLimitsCard } from "./ApiKeyLimitsCard";

describe("ApiKeyLimitsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    load.mockResolvedValue({});
    mutateAsync.mockResolvedValue({ data: {} });
  });

  it("saves the edited display name and description with the configuration", async () => {
    render(
      <ApiKeyLimitsCard
        apiKeyId="key-1"
        workspace="default"
        projectId="project-1"
        displayName="Old name"
        description="Old description"
      />,
    );

    const name = await screen.findByDisplayValue("Old name");
    const description = screen.getByDisplayValue("Old description");
    fireEvent.change(name, { target: { value: "New name" } });
    fireEvent.change(description, { target: { value: "New description" } });
    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        url: "/rpc/update_api_key_configuration",
        method: "post",
        values: {
          p_api_key_id: "key-1",
          p_project_id: "project-1",
          p_display_name: "New name",
          p_description: "New description",
          p_limits: { rps: 10 },
        },
      }),
    );
  });
});
