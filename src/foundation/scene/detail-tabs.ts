/**
 * The tab bar treatment shared by Neutree detail pages: a full-width row of
 * text labels on a hairline, with the active label underlined.
 *
 * Kept in one place because the three detail pages used to carry their own
 * copy — the external endpoint page drifted into the segmented pill shape the
 * `Tabs` primitive defaults to, so the same tabs read differently depending on
 * which resource you opened.
 */
export const detailTabsListClassName =
  "relative mt-0 h-11 w-full items-end justify-start gap-8 rounded-none border-0 bg-transparent p-0 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border";

export const detailTabTriggerClassName =
  "relative z-10 h-full rounded-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:bg-transparent hover:text-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:hover:bg-transparent";
