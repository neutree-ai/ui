/** One user-visible change, as an agent writes it into a change spec file. */
export type Change = {
  /** Matches the bullet of the pull request description's "User-visible changes". */
  id: string;
  title: string;
  /** The id of an entry of `screens.ts`. */
  screen: string;
  /** Playwright selectors of the elements that show the change. */
  highlight: string[];
  /** Selector of what to crop to; default: the highlighted elements, padded. */
  region?: string;
  note?: string;
  setup?: {
    /** Viewport width in px; default 1280. */
    viewport?: number;
    /** Selector to hover before capturing, for tooltips. */
    hover?: string;
    /** Selector to click before capturing, for something collapsed. */
    click?: string;
  };
};

export type ChangeSpec = { changes: Change[] };

/** What was captured of one change on one side. */
export type Capture = {
  id: string;
  /** Matches per highlight selector, in the order given. */
  matches: number[];
  /** Whether `region` was given and matched. */
  regionMatched: boolean | null;
  unmocked: string[];
};
