import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useWorkspaceForm } from "./use-workspace-form";

vi.mock("@refinedev/core", () => ({
  useTranslation: () => ({ translate: (key: string) => key }),
}));

function renderWorkspace(action: "create" | "edit") {
  return renderForm(
    () => useWorkspaceForm({ action }),
    (r) => r.metadataFields,
  );
}

function makeWorkspace(display_name: string | null) {
  return {
    id: 7,
    api_version: "v1" as const,
    kind: "Workspace" as const,
    metadata: {
      name: "research",
      display_name,
      workspace: null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-02T00:00:00Z",
      deletion_timestamp: null,
      labels: { team: "research" },
      annotations: { owner: "operations" },
    },
    status: { phase: "Created", service_url: "https://example.org" },
  };
}

describe("useWorkspaceForm payloads", () => {
  it.each(["research", "", "Invalid Name", " research "])(
    "submits create name %j without trimming or client rejection",
    async (name) => {
      const { result } = renderWorkspace("create");
      fireEvent.change(screen.getByLabelText("common.fields.name"), {
        target: { value: name },
      });

      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

      expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
        api_version: "v1",
        kind: "Workspace",
        metadata: { name },
      });
    },
  );

  it.each(["Research", "", null])(
    "reopens display name %j and preserves the loaded record on untouched submit",
    async (displayName) => {
      const { result } = renderWorkspace("edit");
      const record = makeWorkspace(displayName);
      act(() => result.current.form.reset(record));

      const name = screen.getByLabelText(
        "common.fields.name",
      ) as HTMLInputElement;
      expect(name.value).toBe("research");
      expect(name.disabled).toBe(true);
      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

      expect(refineForm.onFinish.mock.calls[0][0]).toEqual(record);
    },
  );
});
