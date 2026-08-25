import type { Options as SanitizeOptions } from "rehype-sanitize";
import { defaultSchema } from "rehype-sanitize";

/**
 * What a model card is allowed to render as HTML.
 *
 * Cards on a public hub are written in markdown that carries raw HTML, and the
 * conventions are load-bearing rather than decorative: a centred title block, a
 * logo, a row of badges, a `<details>` holding the long benchmark table. Passing
 * that through as text — which is what happens with no HTML step at all — turns
 * the top of a typical card into a wall of angle brackets.
 *
 * So the HTML is rendered, and a card is still content from outside this system
 * that anybody who can publish to a hub can write. The safety argument is no
 * longer "nothing here produces HTML"; it is this allow-list, applied by
 * `hast-util-sanitize` to the parsed tree after `rehype-raw` has turned raw
 * nodes back into elements and before anything reaches React:
 *
 * - the tag list is an allow-list, so `script`, `iframe`, `object`, `embed`,
 *   `form` and everything else not named are dropped rather than escaped;
 * - the attribute list is an allow-list too, so no `on*` handler survives, and
 *   `style` is not on it — inline CSS is how a card would otherwise cover the
 *   page it is embedded in;
 * - `href` and `src` are restricted by protocol, which is what stops
 *   `javascript:` and `data:` URLs;
 * - `id` and `name` are prefixed, so a card cannot mint an element that
 *   collides with one of this app's.
 *
 * Everything below is the published default schema — the one modelled on what
 * GitHub itself permits in a README — plus the single addition noted there.
 * Widening it further is a security decision and belongs in review as one: the
 * two tags most likely to be asked for, `iframe` and `video`, are the two that
 * hand a card the ability to run and play things on its own initiative.
 */
export const modelCardSanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Long deprecated and still all over the hub, where it wraps the title
    // block of cards written years ago. It is an inert container: it carries no
    // attributes and does nothing but centre its children.
    "center",
  ],
};
