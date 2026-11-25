import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const projects = [{ id: "project-1", metadata: { name: "Billing" } }];
vi.mock("@/domains/api-key/hooks/use-api-key-projects", () => ({
  useApiKeyProjects: () => ({ data: projects }),
}));

vi.mock("@/domains/api-key/components/ProjectPicker", () => ({
  ProjectPicker: () => <div>Project picker</div>,
}));

vi.mock("@/foundation/role/FormCombobox", () => ({
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

const createdKey = (spec: object = {}, display_name = "Created key") => ({
  id: "key-1",
  metadata: { name: "apikey-1", display_name },
  spec: { project_id: null, description: "", ...spec },
  status: { sk_value: "created-secret" },
});

const submitNamed = (name: string) => {
  fireEvent.change(
    screen.getByTestId("field-name").querySelector("input") as HTMLInputElement,
    { target: { value: name } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "api_keys.buttons.create" }),
  );
};

describe("CreateApiKeyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({
      data: createdKey(),
    });
    invalidate.mockResolvedValue(undefined);
  });

  it("submits from the button, never on Enter inside a field", async () => {
    render(
      <CreateApiKeyForm
        onClose={vi.fn()}
        initialWorkspace="default"
        initialProjectId="project-1"
      />,
    );

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
      expect(mutateAsync).toHaveBeenCalledWith({
        url: "/rpc/create_api_key",
        method: "post",
        values: {
          p_workspace: "default",
          p_name: null,
          p_display_name: "my-key",
          p_project_id: "project-1",
          p_description: "",
          p_quota: 0,
          p_limits: {},
        },
        successNotification: false,
        errorNotification: false,
      });
    });
    await screen.findByText("created-secret");
    expect(screen.queryByTestId("field-name")).toBeNull();
  });

  it("creates an application key without a project", async () => {
    render(
      <CreateApiKeyForm
        onClose={vi.fn()}
        serviceAccountId="sa-7"
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
          url: "/rpc/create_service_account_api_key",
          values: {
            p_service_account_id: "sa-7",
            p_workspace: "default",
            p_display_name: "app-key",
            p_description: "",
            p_limits: {},
          },
        }),
      );
    });
  });

  it("summarizes the created key from the response, not the form", async () => {
    mutateAsync.mockResolvedValue({
      data: createdKey(
        { project_id: "project-1", description: "Prod traffic" },
        "Server name",
      ),
    });
    render(<CreateApiKeyForm onClose={vi.fn()} initialWorkspace="default" />);
    submitNamed("typed");

    const summary = await screen.findByTestId("key-summary");
    expect(summary.textContent).toContain("Billing");
    expect(summary.textContent).toContain("Server name");
    expect(summary.textContent).toContain("Prod traffic");
    screen.getByText("created-secret");
  });

  it("shows ungrouped and an empty description for a key without either", async () => {
    render(<CreateApiKeyForm onClose={vi.fn()} initialWorkspace="default" />);
    submitNamed("plain");

    const summary = await screen.findByTestId("key-summary");
    expect(summary.textContent).toContain("api_keys.projects.ungrouped");
    expect(summary.textContent).toContain("Created key");
    within(summary).getByTestId("empty-value");
    expect(summary.textContent).not.toMatch(/undefined|null/);
  });

  it("leaves the Project out of an application key's summary", async () => {
    render(
      <CreateApiKeyForm
        onClose={vi.fn()}
        serviceAccountId="sa-7"
        initialWorkspace="default"
      />,
    );
    submitNamed("app-key");

    const summary = await screen.findByTestId("key-summary");
    expect(summary.textContent).not.toContain("api_keys.fields.project");
    expect(summary.textContent).toContain("Created key");
  });
});
