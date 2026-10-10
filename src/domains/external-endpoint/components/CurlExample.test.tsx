import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));

// The hint is built by splitting the translated string on two placeholders, so
// the fake translation has to carry them for those branches to run.
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "external_endpoints.messages.curlHint"
        ? "First run {{exportCmd}}, then open {{apiKeyPage}}."
        : key,
  }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy: copyMock, copied: false }),
}));

import CurlExample from "./CurlExample";

function renderExample(models: string[]) {
  return render(
    <CurlExample serviceUrl="https://gateway.example.com" models={models} />,
    { wrapper: MemoryRouter },
  );
}

describe("CurlExample", () => {
  it("renders the setup hint with the inline export and the API-key link", () => {
    const { container } = renderExample(["gpt-6-astra"]);
    const hint = container.querySelector("code")?.textContent ?? "";
    expect(hint).toContain("export ENDPOINT_API_KEY");
    const link = screen.getByRole("link", { name: "api_keys.title" });
    expect(link.getAttribute("href")).toBe("/default/api-keys");
  });

  it("switches the command with the tab and offers a picker above one model", () => {
    const { container } = renderExample(["gpt-6-astra", "gpt-5.6"]);
    const command = () => container.querySelector("pre")?.textContent ?? "";
    expect(command()).toContain("/v1/chat/completions");
    expect(screen.getByRole("combobox")).toBeTruthy();

    // Radix switches tabs on mousedown, not on click.
    fireEvent.mouseDown(
      screen.getByRole("tab", {
        name: "external_endpoints.messages.curlExampleAnthropic",
      }),
      { button: 0 },
    );
    expect(command()).toContain("/anthropic/v1/messages");

    fireEvent.mouseDown(
      screen.getByRole("tab", {
        name: "external_endpoints.messages.curlExampleEmbedding",
      }),
      { button: 0 },
    );
    expect(command()).toContain("/v1/embeddings");
  });

  it("copies the command it is showing", () => {
    renderExample(["gpt-6-astra"]);
    fireEvent.click(screen.getByRole("button", { name: "buttons.copy" }));
    expect(copyMock).toHaveBeenCalledTimes(1);
    expect(String(copyMock.mock.calls[0][0])).toContain("/v1/chat/completions");
  });
});
