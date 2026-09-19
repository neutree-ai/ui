import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync }),
  useInvalidate: () => invalidate,
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const form =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return { useForm: form.useForm };
});

// Keep `t` stable across renders; effects that depend on it would otherwise
// re-run on every render.
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("@/domains/api-key/components/ApiKeyPolicyFields", () => ({
  ApiKeyPolicyFields: () => <div>Policy fields</div>,
}));

vi.mock("@/domains/api-key/components/ProjectPicker", () => ({
  ProjectPicker: () => <div>Project picker</div>,
}));

vi.mock("@/foundation/components/FormCombobox", () => ({
  FormCombobox: () => <div>Workspace picker</div>,
}));

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy: vi.fn(), copied: false }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspaceOptions: () => ({ workspaces: [], isLoading: false }),
}));

import { CreateApiKeyForm } from "./CreateApiKeyForm";

describe("CreateApiKeyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ data: { id: "key-1" } });
    invalidate.mockResolvedValue(undefined);
  });

  it("submits from the button, never on Enter inside a field", async () => {
    render(<CreateApiKeyForm onClose={vi.fn()} />);

    const name = screen
      .getByTestId("field-name")
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "my-key" } });

    // The dialog has more than one option, so Enter in a field is refused.
    expect(fireEvent.keyDown(name, { key: "Enter" })).toBe(false);
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "api_keys.buttons.create" }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/rpc/create_api_key" }),
      );
    });
  });
});
