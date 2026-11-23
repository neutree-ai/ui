import type { Metadata } from "@/foundation/types/basic-types";

/** The instant the visual diff freezes the browser clock at. */
export const VISUAL_NOW = "2026-06-01T12:00:00.000Z";

/** The workspace every visual-diff fixture belongs to. */
export const VISUAL_WORKSPACE = "default";

/** Seconds since the epoch of `iso`, as the license API reports dates. */
export const unixSeconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** Metadata with fixed timestamps, so a rendered page never depends on when it ran. */
export function fixtureMetadata(
  name: string,
  overrides: Partial<Metadata> = {},
): Metadata {
  return {
    name,
    display_name: null,
    workspace: null,
    deletion_timestamp: null,
    creation_timestamp: "2026-03-01T08:00:00Z",
    update_timestamp: "2026-05-20T09:30:00Z",
    labels: {},
    annotations: {},
    ...overrides,
  };
}
