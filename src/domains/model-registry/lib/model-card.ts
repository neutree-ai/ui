/**
 * A model card is markdown with a YAML front-matter block on the front, which is
 * where hubs keep the card's own metadata — licence, tags, pipeline, base model.
 *
 * Markdown has no notion of front matter, so a renderer that is handed the whole
 * document reads the opening `---` as a thematic break and the closing one as a
 * setext heading, turning the metadata into a wall of bold text above the card.
 * Removing the block is presentation, not editing: nothing is dropped that the
 * card meant as prose.
 */

/** Matches a front-matter block only at the very start of the document, with an
 * unambiguous `---` fence on its own line at each end. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

/**
 * Splits a model card into its front matter and its prose.
 *
 * A document that does not open with a fence is all prose — an opening `---`
 * with no closing one is a thematic break the author wrote, and is left alone.
 */
export function splitModelCard(markdown: string): {
  frontMatter: string | null;
  body: string;
} {
  const match = FRONT_MATTER.exec(markdown);

  if (!match) {
    return { frontMatter: null, body: markdown };
  }

  return {
    frontMatter: match[1],
    body: markdown.slice(match[0].length),
  };
}
