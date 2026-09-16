import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegistryUrl } from "@/domains/model-registry/components/RegistryUrl";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const copy = vi.fn();
vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy, copied: false }),
}));

// The tooltip relies on the app-wide provider mounted in BaseLayout; this test
// renders the component in isolation, so it stands in.
const renderWithTooltip = (ui: ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

const LONG_NFS = "nfs://models.internal/volumes/models/registry/prod";

describe("RegistryUrl", () => {
  it("links a hub address out and opens it in a new tab", () => {
    renderWithTooltip(<RegistryUrl url="https://huggingface.co" />);

    const link = screen.getByRole("link", { name: "https://huggingface.co" });
    expect(link.getAttribute("href")).toBe("https://huggingface.co");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("links a plain-http hub address out too", () => {
    // A self-hosted or mirrored hub is often reached over http on an internal
    // network; it is still an address a browser can open.
    renderWithTooltip(<RegistryUrl url="http://hub.internal:8080" />);

    const link = screen.getByRole("link", { name: "http://hub.internal:8080" });
    expect(link.getAttribute("href")).toBe("http://hub.internal:8080");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("renders a mount path as a value, not as something to open", () => {
    renderWithTooltip(<RegistryUrl url="nfs://10.24.8.31/srv/models" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("nfs://10.24.8.31/srv/models")).toBeDefined();
  });

  it("keeps an address that fits in full", () => {
    renderWithTooltip(<RegistryUrl url="nfs://10.24.8.31/srv/models" />);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shortens a long address in the middle, keeping scheme and tail", () => {
    renderWithTooltip(<RegistryUrl url={LONG_NFS} />);

    expect(
      screen.getByText("nfs://models.internal/…models/registry/prod"),
    ).toBeDefined();
  });

  it("offers the full address on hover when the value is shortened", async () => {
    renderWithTooltip(<RegistryUrl url={LONG_NFS} />);

    fireEvent.focus(
      screen.getByText("nfs://models.internal/…models/registry/prod"),
    );

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe(LONG_NFS);
  });

  it("copies the full address even when the value shown is shortened", () => {
    renderWithTooltip(<RegistryUrl url={LONG_NFS} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "model_registries.actions.copyUrl",
      }),
    );

    expect(copy).toHaveBeenCalledWith(LONG_NFS, expect.anything());
  });
});
