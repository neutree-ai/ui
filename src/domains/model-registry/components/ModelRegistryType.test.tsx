import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModelRegistryType, {
  modelRegistryTypeOptions,
  modelRegistryUrlPlaceholder,
} from "@/domains/model-registry/components/ModelRegistryType";

// Stands in for the locale file. The assertions below check resolved text
// rather than key names, so a kind that falls through to its raw identifier
// shows up as exactly that.
const MESSAGES: Record<string, string> = {
  "model_registries.types.huggingFace": "Hugging Face",
  "model_registries.types.modelScope": "ModelScope",
  "model_registries.types.fileSystem": "File System",
  "model_registries.placeholders.huggingFaceUrl": "e.g https://huggingface.co",
  "model_registries.placeholders.modelScopeUrl":
    "e.g https://www.modelscope.cn",
  "model_registries.placeholders.fileSystemUrl": "e.g nfs://path/to/registry",
};

const translate = (key: string) => MESSAGES[key] ?? key;

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => translate(key) }),
}));

describe("ModelRegistryType", () => {
  it("names a ModelScope registry rather than showing its raw type", () => {
    render(<ModelRegistryType type="model-scope" />);

    expect(screen.getByText("ModelScope")).toBeTruthy();
    expect(screen.queryByText("model-scope")).toBeNull();
  });

  it("names the kinds that were already supported", () => {
    const { unmount } = render(<ModelRegistryType type="hugging-face" />);
    expect(screen.getByText("Hugging Face")).toBeTruthy();
    unmount();

    render(<ModelRegistryType type="bentoml" />);
    expect(screen.getByText("File System")).toBeTruthy();
  });

  it("falls back to the raw identifier for a kind it cannot describe", () => {
    // A server newer than this build can report a kind nobody here has heard
    // of. Showing the identifier is the honest answer; an empty cell is not.
    render(<ModelRegistryType type="some-future-hub" />);

    expect(screen.getByText("some-future-hub")).toBeTruthy();
  });

  it("draws the ModelScope icon locally", () => {
    // An installation with no route to the internet cannot load a remote logo,
    // and there is no fallback for one that fails.
    const { container } = render(<ModelRegistryType type="model-scope" />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});

describe("modelRegistryTypeOptions", () => {
  it("offers ModelScope alongside the other creatable kinds", () => {
    expect(modelRegistryTypeOptions(translate)).toEqual([
      { label: "Hugging Face", value: "hugging-face" },
      { label: "ModelScope", value: "model-scope" },
      { label: "File System", value: "bentoml" },
    ]);
  });
});

describe("modelRegistryUrlPlaceholder", () => {
  it("offers each kind an example in the form its address takes", () => {
    expect(modelRegistryUrlPlaceholder("model-scope", translate)).toBe(
      "e.g https://www.modelscope.cn",
    );
    expect(modelRegistryUrlPlaceholder("hugging-face", translate)).toBe(
      "e.g https://huggingface.co",
    );
    expect(modelRegistryUrlPlaceholder("bentoml", translate)).toBe(
      "e.g nfs://path/to/registry",
    );
  });

  it("offers no example for a kind it cannot describe", () => {
    // Better than borrowing another kind's: an nfs:// example under a field
    // that wants a hub URL tells the user to type something that cannot work.
    expect(modelRegistryUrlPlaceholder("some-future-hub", translate)).toBe(
      undefined,
    );
  });
});
