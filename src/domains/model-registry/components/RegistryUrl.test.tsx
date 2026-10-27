import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegistryUrl } from "@/domains/model-registry/components/RegistryUrl";

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
  // A self-hosted or mirrored hub is often reached over plain http on an
  // internal network; it is still an address a browser can open.
  it.each(["https://huggingface.co", "http://hub.internal:8080"])(
    "links %s out and opens it in a new tab",
    (url) => {
      renderWithTooltip(<RegistryUrl url={url} />);

      const link = screen.getByRole("link", { name: url });
      expect(link.getAttribute("href")).toBe(url);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    },
  );

  it("renders a mount path as a value, not as something to open", () => {
    renderWithTooltip(<RegistryUrl url="nfs://10.24.8.31/srv/models" />);

    expect(screen.queryByRole("link")).toBeNull();
    screen.getByText("nfs://10.24.8.31/srv/models");
  });

  it("shortens a long address in the middle, keeping scheme and tail", () => {
    renderWithTooltip(<RegistryUrl url={LONG_NFS} />);

    screen.getByText("nfs://models.internal/…models/registry/prod");
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
