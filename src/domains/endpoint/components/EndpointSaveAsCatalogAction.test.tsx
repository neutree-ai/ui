import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: mocks.mutateAsync, isLoading: false }),
  useInvalidate: () => mocks.invalidate,
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("@/foundation/components/Table", () => ({
  RowAction: ({ onClick, title }: { onClick: () => void; title: string }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

import {
  EndpointSaveAsCatalogAction,
  EndpointSaveAsCatalogProvider,
} from "./EndpointSaveAsCatalogAction";

const endpoint = {
  metadata: { name: "qwen-chat", workspace: "team-a", labels: {} },
  spec: {
    cluster: "prod",
    model: { registry: "hf", name: "Qwen/Qwen3-8B", version: "v2" },
    engine: { engine: "vllm", version: "0.24" },
    resources: { cpu: "4", memory: "16Gi", gpu: "1" },
    replicas: { num: 2 },
    deployment_options: null,
    variables: { engine_args: {} },
    env: null,
  },
} as unknown as Endpoint;

const renderAction = () =>
  render(
    <EndpointSaveAsCatalogProvider>
      <EndpointSaveAsCatalogAction endpoint={endpoint} />
    </EndpointSaveAsCatalogProvider>,
  );

const openDialog = () => {
  fireEvent.click(screen.getByText("endpoints.actions.saveAsCatalog"));
};

const nameInput = () =>
  screen.getByLabelText("endpoints.saveAsCatalog.nameLabel");

describe("EndpointSaveAsCatalogAction", () => {
  beforeEach(() => {
    mocks.invalidate.mockReset().mockResolvedValue(undefined);
    mocks.mutateAsync.mockReset().mockResolvedValue({});
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it("offers the endpoint's own name and creates a catalog under it", async () => {
    renderAction();
    openDialog();

    expect((nameInput() as HTMLInputElement).value).toBe("qwen-chat");

    fireEvent.click(screen.getByText("endpoints.saveAsCatalog.submit"));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    const call = mocks.mutateAsync.mock.calls[0][0];
    expect(call.resource).toBe("model_catalogs");
    expect(call.values.metadata.name).toBe("qwen-chat");
    expect(call.values.spec.model.name).toBe("Qwen/Qwen3-8B");
    expect(call.values.spec).not.toHaveProperty("replicas");
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("creates under the name the user typed", async () => {
    renderAction();
    openDialog();

    fireEvent.change(nameInput(), { target: { value: "qwen-tuned" } });
    fireEvent.click(screen.getByText("endpoints.saveAsCatalog.submit"));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync.mock.calls[0][0].values.metadata.name).toBe(
      "qwen-tuned",
    );
  });

  // The typed name is the only thing to fix, so it must survive the refusal.
  it("keeps the dialog open when the name is taken", async () => {
    mocks.mutateAsync.mockRejectedValue({ code: "23505" });

    renderAction();
    openDialog();
    fireEvent.click(screen.getByText("endpoints.saveAsCatalog.submit"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "endpoints.messages.saveAsCatalogDuplicate",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("closes on success", async () => {
    renderAction();
    openDialog();
    fireEvent.click(screen.getByText("endpoints.saveAsCatalog.submit"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

// The action lives inside a dropdown menu, which closes on the very click that
// opens the dialog. A dialog rendered by the action itself goes with it — the
// symptom is a dialog that flashes and vanishes. The provider holds it instead.
describe("dialog placement", () => {
  function MenuHarness() {
    const [menuOpen, setMenuOpen] = useState(true);

    return (
      <EndpointSaveAsCatalogProvider>
        {menuOpen && (
          <div>
            <EndpointSaveAsCatalogAction endpoint={endpoint} />
            <button type="button" onClick={() => setMenuOpen(false)}>
              close menu
            </button>
          </div>
        )}
      </EndpointSaveAsCatalogProvider>
    );
  }

  it("survives the menu that opened it going away", () => {
    render(<MenuHarness />);

    fireEvent.click(screen.getByText("endpoints.actions.saveAsCatalog"));
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.click(screen.getByText("close menu"));

    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("does nothing without a provider rather than opening a lost dialog", () => {
    render(<EndpointSaveAsCatalogAction endpoint={endpoint} />);

    fireEvent.click(screen.getByText("endpoints.actions.saveAsCatalog"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
