import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode, Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPlayground from "@/domains/endpoint/components/ChatPlayground";
import type { Endpoint } from "@/domains/endpoint/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The child selectors take their translations from the app's i18n module,
// which initialises i18next on import.
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  AVAILABLE_LOCALES: ["en-US"],
  LOCALE_LABELS: { "en-US": "English" },
  resolveSupportedLocale: (locale?: string) => locale ?? "en-US",
  syncDocumentLanguage: () => {},
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  i18n: { language: "en-US", changeLanguage: () => Promise.resolve() },
}));

vi.mock("@/foundation/lib/api", () => ({
  clientPostgrest: { headers: {} },
}));

// The sidebar is untouched by this behaviour: its sliders and pickers are
// Radix widgets that measure themselves, which jsdom cannot do. Keeping them
// out leaves the transcript itself — the part that was changed — on real code.
vi.mock("./ChatSidebar", () => ({
  ChatSidebar: ({ children }: { children: ReactNode }) => (
    <aside>{children}</aside>
  ),
}));
vi.mock("./MaxLengthSelector", () => ({ MaxLengthSelector: () => null }));
vi.mock("./TemperatureSelector", () => ({ TemperatureSelector: () => null }));
vi.mock("./TopPSelector", () => ({ TopPSelector: () => null }));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => () => ({ modelId: "mock-model" }),
}));

/** What the model streams back for the next send. */
const stream = vi.hoisted(() => ({
  deltas: [] as Array<Record<string, unknown>>,
}));

vi.mock("ai", () => ({
  jsonSchema: (schema: unknown) => schema,
  tool: (definition: unknown) => definition,
  streamText: () => ({
    fullStream: (async function* () {
      for (const delta of stream.deltas) yield delta;
    })(),
  }),
}));

// The playground selects its own model once the endpoint reports one. The guard
// matters: setting the value on every render would notify the form, re-render,
// and set it again.
vi.mock("@/domains/endpoint/hooks/use-playground-models", () => ({
  usePlaygroundModels: (
    _endpoint: Endpoint,
    form: {
      getValues: (name: string) => unknown;
      setValue: (name: string, value: string) => void;
    },
  ) => {
    if (!form.getValues("model")) form.setValue("model", "mock-model");
    return {
      models: [{ label: "mock-model", value: "mock-model" }],
      isLoading: false,
    };
  },
}));

// ScrollArea itself is covered by its own test; Radix's scrollbar needs layout
// this environment does not have, so the transcript stands on a plain box here
// and the component still hands it the viewport ref it would get in the app.
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    viewportRef,
  }: {
    children: ReactNode;
    viewportRef?: Ref<HTMLDivElement>;
  }) => (
    <div ref={viewportRef} data-testid="transcript">
      {children}
    </div>
  ),
}));

type Observer = { callback: ResizeObserverCallback };
let observers: Observer[] = [];

class FakeResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const endpoint = {
  metadata: { name: "deepseek-r1", workspace: "design-lab" },
} as unknown as Endpoint;

/**
 * jsdom has no layout, so the transcript's scroll box is described by hand: a
 * container that clamps its scrollTop the way a browser does, and scroll events
 * the test fires when it wants to stand in for the reader.
 */
function describeTranscript(element: HTMLElement) {
  let top = 0;
  let scrollHeight = 400;
  const clientHeight = 200;
  const maxTop = () => Math.max(0, scrollHeight - clientHeight);

  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.min(Math.max(0, value), maxTop());
    },
  });
  element.scrollTo = ((options: ScrollToOptions) => {
    top = Math.min(Math.max(0, options.top ?? 0), maxTop());
  }) as typeof element.scrollTo;

  return {
    scrollTop: () => top,
    maxTop,
    /** The transcript grew — a streamed answer, or markdown settling. */
    contentGrowsTo: (height: number) => {
      scrollHeight = height;
      act(() => {
        for (const observer of observers) {
          observer.callback([], observer as unknown as ResizeObserver);
        }
      });
    },
    readerScrollsTo: (value: number) => {
      top = Math.min(Math.max(0, value), maxTop());
      act(() => {
        element.dispatchEvent(new Event("scroll"));
      });
    },
  };
}

function renderPlayground() {
  render(<ChatPlayground endpoint={endpoint} />);
  const transcript = screen.getByTestId("transcript");
  return { transcript, scroll: describeTranscript(transcript) };
}

async function sendMessage(text: string) {
  const input = screen.getByPlaceholderText(
    "components.playground.chat.chatPlaceholder",
  );
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "components.playground.chat.send" }),
    );
  });
}

const latestButton = () =>
  screen.queryByRole("button", {
    name: "components.playground.chat.jumpToLatest",
  });

beforeEach(() => {
  observers = [];
  stream.deltas = [
    { type: "text-delta", text: "The answer " },
    { type: "text-delta", text: "arrives in pieces." },
  ];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  // jsdom has no object URLs, which is how an attachment is previewed.
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:mock",
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatPlayground transcript", () => {
  it("shows the conversation, including what streamed back", async () => {
    renderPlayground();

    await sendMessage("what is slow?");

    expect(screen.getByText("what is slow?")).toBeDefined();
    expect(screen.getByText("The answer arrives in pieces.")).toBeDefined();
  });

  it("renders every kind of content a turn can carry", async () => {
    stream.deltas = [
      { type: "reasoning-delta", text: "weighing the options" },
      { type: "text-delta", text: "Here is the answer." },
      {
        type: "tool-call",
        toolName: "get_weather",
        input: { city: "Shanghai" },
      },
      { type: "error", error: "the engine stopped responding" },
    ];
    renderPlayground();

    await sendMessage("what is the weather?");

    expect(screen.getByText("weighing the options")).toBeDefined();
    expect(screen.getByText("Here is the answer.")).toBeDefined();
    expect(screen.getByText(/get_weather/)).toBeDefined();
    expect(screen.getByText("the engine stopped responding")).toBeDefined();
  });

  it("renders an image the reader attached to their message", async () => {
    const { scroll } = renderPlayground();
    const fileInput = document.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, {
        target: {
          files: [new File(["chart"], "chart.png", { type: "image/png" })],
        },
      });
    });
    // Reading the file is a FileReader round-trip, which settles after the act
    // above returns; the composer shows the thumbnail once it has.
    await waitFor(() =>
      expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull(),
    );
    await sendMessage("what does this chart show?");
    scroll.contentGrowsTo(700);

    // The thumbnail in the composer is a blob URL; the message itself carries
    // the data URI, which is the one the transcript has to render.
    expect(document.querySelector('img[src^="data:image/png"]')).not.toBeNull();
  });

  it("follows the end of the conversation as the answer streams", async () => {
    const { scroll } = renderPlayground();

    await sendMessage("what is slow?");
    scroll.contentGrowsTo(900);

    expect(scroll.scrollTop()).toBe(scroll.maxTop());
    expect(latestButton()).toBeNull();
  });

  it("offers a way back when the reader scrolls up, and takes it", async () => {
    const { scroll } = renderPlayground();
    await sendMessage("what is slow?");
    scroll.contentGrowsTo(900);

    scroll.readerScrollsTo(120);
    expect(latestButton()).not.toBeNull();

    // New content arrives while the reader is still reading history.
    scroll.contentGrowsTo(1200);
    expect(scroll.scrollTop()).toBe(120);

    fireEvent.click(latestButton() as HTMLElement);

    expect(scroll.scrollTop()).toBe(scroll.maxTop());
    expect(latestButton()).toBeNull();
  });

  it("returns to the end when a message is sent, even after scrolling up", async () => {
    const { scroll } = renderPlayground();
    await sendMessage("first");
    scroll.contentGrowsTo(900);
    scroll.readerScrollsTo(0);
    expect(latestButton()).not.toBeNull();

    await sendMessage("second");
    scroll.contentGrowsTo(1300);

    expect(scroll.scrollTop()).toBe(scroll.maxTop());
    expect(latestButton()).toBeNull();
  });
});
