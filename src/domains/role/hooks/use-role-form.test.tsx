import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useRoleForm } from "./use-role-form";

vi.mock("@refinedev/core", () => ({
  useTranslation: () => ({ translate: (key: string) => key }),
}));

function renderRole(action: "create" | "edit") {
  return renderForm(
    () => useRoleForm({ action }),
    (r) => (
      <TooltipProvider>
        {r.metadataFields}
        {r.specFields}
      </TooltipProvider>
    ),
  );
}

function makeRole(permissions: string[], preset_key: string | null = null) {
  return {
    id: 7,
    api_version: "v1" as const,
    kind: "Role" as const,
    metadata: {
      name: "reader",
      display_name: "Readers",
      workspace: null,
      annotations: { owner: "operations" },
    },
    spec: { preset_key, permissions },
    status: { phase: "Created" },
  };
}

describe("useRoleForm payloads", () => {
  it.each(["reader", "", "Invalid Name"])(
    "submits create name %j with the empty custom permission set",
    async (name) => {
      const { result } = renderRole("create");
      fireEvent.change(screen.getByLabelText("common.fields.name"), {
        target: { value: name },
      });

      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

      expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
        api_version: "v1",
        kind: "Role",
        metadata: { name },
        spec: { preset_key: null, permissions: [] },
      });
    },
  );

  it.each([
    { permissions: ["role:read"], preset: null, added: [] },
    { permissions: [], preset: null, added: [] },
    {
      permissions: ["model:push"],
      preset: null,
      added: ["model_registry:read", "model:read"],
    },
    {
      permissions: [
        "team:create",
        "cluster:read-credentials",
        "static_node:read",
      ],
      preset: null,
      added: ["team:read", "workspace:read"],
    },
    { permissions: ["role:read"], preset: "department-admin", added: [] },
  ])(
    "reopens $permissions / $preset and submits with $added added",
    async ({ permissions, preset, added }) => {
      const { result } = renderRole("edit");
      const record = makeRole(permissions, preset);
      act(() => result.current.form.reset(record as never));

      expect(
        (screen.getByLabelText("common.fields.name") as HTMLInputElement)
          .disabled,
      ).toBe(true);
      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

      expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
        ...record,
        spec: { ...record.spec, permissions: [...permissions, ...added] },
      });
    },
  );

  it("submits an edited permission selection with the rest of the record intact", async () => {
    const { result } = renderRole("edit");
    const record = makeRole(["role:read"]);
    act(() => result.current.form.reset(record as never));
    fireEvent.click(screen.getByText("roles.title:permissions.update"));

    await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

    expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
      ...record,
      spec: { preset_key: null, permissions: ["role:read", "role:update"] },
    });
  });
});
