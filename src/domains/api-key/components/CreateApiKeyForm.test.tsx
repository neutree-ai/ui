import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync }),
  useInvalidate: () => invalidate,
}));

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
  ALL_WORKSPACES: "_all_",
  useWorkspace: () => ({ current: "_all_", isLoading: false }),
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

  it("creates a Team key without a project", async () => {
    render(
      <CreateApiKeyForm
        onClose={vi.fn()}
        teamId={7}
        initialWorkspace="default"
      />,
    );

    expect(screen.queryByTestId("field-project_id")).toBeNull();
    const name = screen
      .getByTestId("field-name")
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "app-key" } });
    fireEvent.click(
      screen.getByRole("button", { name: "api_keys.buttons.create" }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/rpc/create_team_api_key",
          values: expect.objectContaining({
            p_team_id: 7,
            p_workspace: "default",
            p_display_name: "app-key",
          }),
        }),
      );
    });
  });
});
