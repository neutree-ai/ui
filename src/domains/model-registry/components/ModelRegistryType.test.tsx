import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModelRegistryType, {
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
  it.each([
    ["model-scope", "ModelScope"],
    ["hugging-face", "Hugging Face"],
    ["bentoml", "File System"],
  ])("names a %s registry rather than showing its raw type", (type, name) => {
    render(<ModelRegistryType type={type} />);

    screen.getByText(name);
    expect(screen.queryByText(type)).toBeNull();
  });

  it("falls back to the raw identifier for a kind it cannot describe", () => {
    // A server newer than this build can report a kind nobody here has heard
    // of. Showing the identifier is the honest answer; an empty cell is not.
    render(<ModelRegistryType type="some-future-hub" />);

    screen.getByText("some-future-hub");
  });

  it("draws the ModelScope icon locally", () => {
    // An installation with no route to the internet cannot load a remote logo,
    // and there is no fallback for one that fails.
    const { container } = render(<ModelRegistryType type="model-scope" />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});

describe("modelRegistryUrlPlaceholder", () => {
  it.each([
    ["model-scope", "e.g https://www.modelscope.cn"],
    ["hugging-face", "e.g https://huggingface.co"],
    ["bentoml", "e.g nfs://path/to/registry"],
  ])("offers %s an example in the form its address takes", (type, example) => {
    expect(modelRegistryUrlPlaceholder(type, translate)).toBe(example);
  });

  it("offers no example for a kind it cannot describe", () => {
    // Better than borrowing another kind's: an nfs:// example under a field
    // that wants a hub URL tells the user to type something that cannot work.
    expect(modelRegistryUrlPlaceholder("some-future-hub", translate)).toBe(
      undefined,
    );
  });
});
