import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Resolved against the real locale file rather than echoed back, so the
// assertions below are about the sentences a user reads -- and a key that never
// made it into the locale fails here rather than shipping as its own name.
vi.mock("@/foundation/lib/i18n", async () => {
  const en = (await import("@/locales/en-US.json")).default as Record<
    string,
    unknown
  >;

  const lookup = (key: string): string | undefined => {
    const found = key
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        en,
      );

    return typeof found === "string" ? found : undefined;
  };

  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) =>
        (lookup(key) ?? key).replace(/{{(\w+)}}/g, (_, name) =>
          String(options?.[name] ?? ""),
        ),
    }),
  };
});

const useCustom = vi.fn();
const useList = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustom: (args: unknown) => useCustom(args),
  useList: (args: unknown) => useList(args),
}));

const useImageRepositories = vi.fn();

vi.mock("@/foundation/hooks/use-image-repositories", () => ({
  useImageRepositories: (args: unknown) => useImageRepositories(args),
}));

// A select plus a search box, which is what a combobox is once the popover is
// taken away. Following the shape CatalogModelSlots' tests already use, with
// the search input added because these levels search on the server.
vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({
    onChange,
    onSearchChange,
    options,
    value,
    placeholder,
    disabled,
    modal,
  }: {
    onChange: (value: string) => void;
    onSearchChange?: (search: string) => void;
    options: { label: string; value: string }[];
    value: string;
    placeholder: string;
    disabled?: boolean;
    modal?: boolean;
  }) => (
    <div data-testid="combobox" data-modal={String(Boolean(modal))}>
      <select
        aria-label={placeholder}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {onSearchChange && (
        <input
          aria-label={`${placeholder} search`}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      )}
    </div>
  ),
}));

import { ImageRegistryExplorerDialog } from "./ImageRegistryExplorerDialog";

type Capability =
  | "harbor-projects"
  | "namespace-required"
  | "unauthorized"
  | "unsupported"
  | null;

function registryRow({
  name = "cluster-hub",
  url = "https://registry.example.com",
  repository = "team",
  capability = "harbor-projects" as Capability,
} = {}) {
  return {
    metadata: { name },
    spec: { url, repository },
    status: capability
      ? { capabilities: { list_repositories: capability } }
      : {},
  };
}

/** useList now serves three resources, so the mock answers by resource. */
function answerLists({
  registries = [registryRow()],
  endpoints = [] as unknown[],
  engines = [] as unknown[],
}: {
  registries?: ReturnType<typeof registryRow>[];
  endpoints?: unknown[];
  engines?: unknown[];
} = {}) {
  useList.mockImplementation((args: { resource: string }) => {
    const byResource: Record<string, unknown[]> = {
      image_registries: registries,
      endpoints,
      engines,
    };

    return {
      data: { data: byResource[args.resource] ?? [] },
      isLoading: false,
    };
  });
}

function answerRegistries(rows: ReturnType<typeof registryRow>[]) {
  answerLists({ registries: rows });
}

function answerRepositories(
  repositories: string[] = [],
  { error = null as { reason?: string } | null, isFetching = false } = {},
) {
  useImageRepositories.mockReturnValue({
    repositories,
    total: null,
    hasMore: false,
    isLoading: false,
    isFetching,
    error,
  });
}

function answerTags(tags: string[] = [], { isFetching = false } = {}) {
  useCustom.mockReturnValue({ data: { data: { tags } }, isFetching });
}

function open(
  props: Partial<Parameters<typeof ImageRegistryExplorerDialog>[0]> = {},
) {
  const onApply = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <ImageRegistryExplorerDialog
      open
      onOpenChange={onOpenChange}
      workspace="default"
      clusterRegistry="cluster-hub"
      onApply={onApply}
      {...props}
    />,
  );

  return { onApply, onOpenChange };
}

const dockerHubRow = (overrides: Record<string, unknown> = {}) =>
  registryRow({
    url: "docker.io",
    repository: "",
    capability: "namespace-required",
    ...overrides,
  });

const registrySelect = () => screen.getByLabelText("Select an image registry");
const namespaceSelect = () =>
  screen.getByLabelText("Select or type a namespace");
const namespaceSearch = () =>
  screen.getByLabelText("Select or type a namespace search");
const namespaceOptions = () =>
  Array.from(namespaceSelect().querySelectorAll("option"))
    .map((option) => option.textContent)
    .filter(Boolean);
const imageSelect = () => screen.getByLabelText("Select or type an image");
const imageSearch = () =>
  screen.getByLabelText("Select or type an image search");
const tagSelect = () => screen.getByLabelText("Select or type a tag");
const note = () =>
  screen.getByTestId("image-explorer-capability").textContent ?? "";

describe("ImageRegistryExplorerDialog", () => {
  beforeEach(() => {
    useCustom.mockReset();
    useList.mockReset();
    useImageRepositories.mockReset();
    answerLists();
    answerRepositories([]);
    answerTags([]);
  });

  it("opens on the cluster's registry and marks it as the one in use", () => {
    // Choosing where the pod pulls from is not what this dialog does, so which
    // registry that is has to be visible rather than assumed.
    answerRepositories(["vllm"]);
    open();

    expect((registrySelect() as HTMLSelectElement).value).toBe("cluster-hub");
    expect(screen.getByText(/used by this cluster/)).toBeTruthy();
  });

  it("is usable with no cluster picked at all", () => {
    // The whole reason the registry moved into this dialog: a field with no
    // cluster behind it used to have nothing to offer, and a registry no
    // cluster points at yet was unreachable.
    answerRegistries([registryRow({ name: "fresh-hub" })]);
    answerRepositories(["x"]);
    open({ clusterRegistry: null });

    expect((registrySelect() as HTMLSelectElement).value).toBe("");

    fireEvent.change(registrySelect(), { target: { value: "fresh-hub" } });

    expect(useImageRepositories).toHaveBeenLastCalledWith(
      expect.objectContaining({ registry: "fresh-hub", enabled: true }),
    );
  });

  it("writes back a fully-qualified reference", () => {
    // The Flex image argument is rendered into the pod verbatim, so a relative
    // reference resolves against Docker Hub rather than the registry it was
    // found in.
    answerRepositories(["inner/x"]);
    answerTags(["v1", "v2"]);
    const { onApply, onOpenChange } = open();

    fireEvent.change(imageSelect(), { target: { value: "inner/x" } });
    fireEvent.change(tagSelect(), { target: { value: "v2" } });
    fireEvent.click(screen.getByText("Use this image"));

    expect(onApply).toHaveBeenCalledWith(
      "registry.example.com/team/inner/x:v2",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("accepts an image with no tag", () => {
    answerRepositories(["inner/x"]);
    const { onApply } = open();

    fireEvent.change(imageSelect(), { target: { value: "inner/x" } });
    fireEvent.click(screen.getByText("Use this image"));

    expect(onApply).toHaveBeenCalledWith("registry.example.com/team/inner/x");
  });

  it("warns when the registry being explored is not the cluster's", () => {
    answerRegistries([registryRow(), registryRow({ name: "elsewhere" })]);
    open();

    expect(screen.queryByTestId("image-explorer-foreign-registry")).toBeNull();

    fireEvent.change(registrySelect(), { target: { value: "elsewhere" } });

    expect(
      screen.getByTestId("image-explorer-foreign-registry").textContent,
    ).toContain("cluster-hub");
  });

  describe("each capability", () => {
    it("harbor-projects: lists the registry's images", () => {
      answerRepositories(["vllm", "mineru"]);
      open();

      expect(note()).toContain("Type to narrow the images");
      expect(useImageRepositories).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true }),
      );
      expect(screen.getByRole("option", { name: "mineru" })).toBeTruthy();
    });

    it("namespace-required: gives the namespace its own level", async () => {
      // Docker Hub has no endpoint that enumerates namespaces, so one has to be
      // named. It gets its own box rather than a slash typed into the image
      // box: every level here has a label already, and someone who typed a
      // namespace without the slash used to get nothing at all.
      answerLists({
        registries: [dockerHubRow()],
        endpoints: [
          {
            spec: {
              variables: { engine_args: { image: "vllm/vllm-openai:v1" } },
            },
          },
        ],
      });
      open();

      expect(namespaceSelect()).toBeTruthy();
      expect(
        screen.getByTestId("image-explorer-namespace-note").textContent,
      ).toContain("cannot list namespaces");
      expect(note()).toContain("Choose a namespace above");
      expect(useImageRepositories).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false }),
      );

      answerRepositories(["vllm/vllm-openai"]);
      fireEvent.change(namespaceSelect(), { target: { value: "vllm" } });

      await waitFor(() =>
        expect(useImageRepositories).toHaveBeenLastCalledWith(
          expect.objectContaining({ namespace: "vllm", enabled: true }),
        ),
      );
    });

    it("namespace-required: offers library and what the deployment already uses", () => {
      // Not the full set -- that is unobtainable -- but every entry is true:
      // Docker Hub's official namespace, plus namespaces read out of this
      // installation's own endpoints and engines. No route was added for it.
      answerLists({
        registries: [dockerHubRow()],
        endpoints: [
          {
            spec: {
              variables: { engine_args: { image: "vllm/vllm-openai:v1" } },
            },
          },
        ],
        engines: [
          {
            spec: {
              versions: [{ images: { cpu: { image_name: "neutree/vllm" } } }],
            },
          },
        ],
      });
      open();

      expect(namespaceOptions()).toEqual(["library", "neutree", "vllm"]);
    });

    it("namespace-required: takes a namespace that was typed, not picked", async () => {
      // Nothing suggests `acme`; typing it is what makes it selectable, which
      // is the whole point of these levels being comboboxes.
      answerLists({ registries: [dockerHubRow()] });
      open();

      expect(namespaceOptions()).not.toContain("acme");

      fireEvent.change(namespaceSearch(), { target: { value: "acme" } });
      fireEvent.change(namespaceSelect(), { target: { value: "acme" } });

      await waitFor(() =>
        expect(useImageRepositories).toHaveBeenLastCalledWith(
          expect.objectContaining({ namespace: "acme", enabled: true }),
        ),
      );
    });

    it("harbor-projects: has no namespace level at all", () => {
      // A Harbor's namespace is fixed by the project its registry record is
      // scoped to, so the difference between registries is whether a level
      // exists -- not whether a special character has to be typed into one.
      answerRepositories(["vllm", "mineru"]);
      open();

      expect(screen.queryByLabelText("Select or type a namespace")).toBeNull();
      expect(screen.queryByTestId("image-explorer-namespace-note")).toBeNull();
    });

    it("unsupported: says so and still takes what is typed", () => {
      answerRegistries([registryRow({ capability: "unsupported" })]);
      const { onApply } = open();

      expect(note()).toContain("cannot list its images");
      expect(useImageRepositories).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false }),
      );

      fireEvent.change(imageSearch(), { target: { value: "typed/name" } });
      fireEvent.change(imageSelect(), { target: { value: "typed/name" } });
      fireEvent.click(screen.getByText("Use this image"));

      expect(onApply).toHaveBeenCalledWith(
        "registry.example.com/team/typed/name",
      );
    });

    it("unauthorized: names the credentials as what falls short", () => {
      // A different sentence and a different action from unsupported: this
      // registry can list, and someone has to issue a wider credential.
      answerRegistries([registryRow({ capability: "unauthorized" })]);
      open();

      expect(note()).toContain("Ask an operator for credentials");
    });

    it("never probed: says tags still work", () => {
      answerRegistries([registryRow({ capability: null })]);
      open();

      expect(note()).toContain("has not reported yet");
    });

    it("unreachable: says to try again, and never leaves the line blank", () => {
      answerRepositories([], { error: { reason: "unavailable" } });
      open();

      expect(note()).toContain("could not be reached");
    });

    it("prefers what a request answered over what was recorded", () => {
      // The stored capability is a cached observation; a credential can be
      // rotated between one reconcile and the next.
      answerRegistries([registryRow({ capability: "harbor-projects" })]);
      answerRepositories([], { error: { reason: "registry_unauthorized" } });
      open();

      expect(note()).toContain("Ask an operator for credentials");
    });
  });

  it("asks for a modal popover on every level", () => {
    // A dialog's overlay wraps the page in react-remove-scroll, which allows
    // wheel events only inside its own node and the dialog content handed to it
    // as a shard. A popover portalled to the body is neither, so its list could
    // not be scrolled -- the image level showed it first only because it is the
    // one long enough to need scrolling. A modal popover brings its own scroll
    // lock, whose allowed node is the popover itself.
    //
    // Whether the wheel actually scrolls cannot be asserted here: jsdom has no
    // layout and no scrolling. What is asserted is the decision that fixes it,
    // so removing it fails a test rather than reaching a screen.
    open();

    const modals = screen
      .getAllByTestId("combobox")
      .map((node) => node.getAttribute("data-modal"));

    expect(modals.length).toBeGreaterThan(0);
    expect(modals.every((value) => value === "true")).toBe(true);
  });

  it("reduces a pasted full reference before asking for its tags", () => {
    // The tags route names a repository relative to the registry's own prefix.
    answerRepositories([]);
    open();

    fireEvent.change(imageSearch(), {
      target: { value: "registry.example.com/team/inner/x" },
    });
    fireEvent.change(imageSelect(), {
      target: { value: "registry.example.com/team/inner/x" },
    });

    expect(useCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "/workspaces/default/image_registries/cluster-hub/repositories/inner%2Fx/tags",
      }),
    );
  });

  it("asks for no tags until an image has been chosen", () => {
    open();

    expect(useCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "",
        queryOptions: expect.objectContaining({ enabled: false }),
      }),
    );
  });
});
