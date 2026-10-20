const countFormatter = new Intl.NumberFormat("en-US");

/** The API omits zero counters, so absent reads as 0 (data.md, list). */
export const formatEventCount = (value: number | null | undefined): string =>
  countFormatter.format(value ?? 0);
