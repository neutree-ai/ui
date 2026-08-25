import "github-markdown-css/github-markdown-light.css";
import type { AnchorHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useRegistryModelReadme } from "@/domains/model-registry/hooks/use-registry-model-readme";
import { splitModelCard } from "@/domains/model-registry/lib/model-card";
import { modelCardSanitizeSchema } from "@/domains/model-registry/lib/model-card-html";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import type { RegistryModelRef } from "@/foundation/lib/api/registry-models";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * A model's card, rendered from the markdown the registry stores.
 *
 * ## Why this is safe to display
 *
 * A card is content from outside this system — anybody who can publish to a
 * public hub can write one — and hub cards use raw HTML for the parts that
 * matter most: the centred title block, the logo, the badges, the `<details>`
 * around the long table. So the HTML is rendered, and every step from the wire
 * to the screen treats it as hostile:
 *
 * - the server returns the markdown **as stored** and never renders it, so no
 *   HTML arrives that something else already decided to trust;
 * - `rehype-raw` reparses the raw HTML into the same syntax tree as the
 *   markdown, and `rehype-sanitize` then prunes that tree against
 *   {@link modelCardSanitizeSchema} — an allow-list of tags, attributes and URL
 *   protocols. `<script>` and `<iframe>` are dropped, `onerror=…` never survives
 *   as an attribute, and `javascript:` never survives as a URL. **The two
 *   plugins are a pair: `rehype-raw` without `rehype-sanitize` after it is
 *   `dangerouslySetInnerHTML` on hub content**;
 * - `react-markdown` then builds React elements from what is left, so what
 *   reaches the DOM is a tree this app constructed and not a string it was
 *   handed;
 * - link targets additionally go through the library's default URL transform,
 *   and every link — written in markdown or in raw HTML — is rebuilt by
 *   {@link MarkdownLink} below, so a card cannot choose its own `target` and
 *   carries `rel="noreferrer nofollow"` rather than passing this app's URL on as
 *   a referrer.
 *
 * The XSS acceptance for all of this is asserted in the sibling test rather than
 * argued here.
 *
 * ## Why it is not always present
 *
 * Serving cards is a capability, and having one is separate from that. Where
 * there is no card to show — a registry kind that serves none, or a model with
 * none — this renders nothing at all rather than a section headed "Model card"
 * with an apology in it. A card that *could* not be fetched is a different
 * answer and is reported.
 */

type Props = {
  modelRef: RegistryModelRef;
};

const MarkdownLink = ({
  children,
  href,
}: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a href={href} target="_blank" rel="noreferrer nofollow">
    {children}
  </a>
);

export const ModelReadme = ({ modelRef }: Props) => {
  const { t } = useTranslation();
  const { readme, isLoading, error } = useRegistryModelReadme(modelRef);

  // There is no card, and nothing to say about that. `not_supported` is a
  // registry that serves none; `not_found` is one that does and has none for
  // this model. Either way an empty section headed "Model card" would be a gap
  // pointed at rather than information — the absence of the section *is* the
  // absence of the card. The failures below are different: they mean a card may
  // well exist and could not be fetched, which is worth saying.
  if (error?.reason === "not_supported" || error?.reason === "not_found") {
    return null;
  }

  const body = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-6" data-testid="readme-loading">
          <Loader className="h-4 text-primary" />
        </div>
      );
    }

    if (error) {
      // Reported the way the server worded it, and in the same neutral tone as
      // an absent card: a card that could not be fetched — no network, a hub
      // asking for a token — is a missing nicety, not a broken page, and
      // colouring it as damage is what makes an offline install look on fire.
      return (
        <EmptyState variant="inline" data-testid="readme-unavailable">
          {error.message}
        </EmptyState>
      );
    }

    if (!readme?.content.trim()) {
      return (
        <EmptyState variant="inline" data-testid="readme-empty">
          {t("model_registries.models.readme.none")}
        </EmptyState>
      );
    }

    return (
      <>
        {readme.truncated && (
          <div
            className="mb-2 text-xs text-muted-foreground"
            data-testid="readme-truncated"
          >
            {t("model_registries.models.readme.truncated")}
          </div>
        )}
        <div
          className="markdown-body max-w-none overflow-x-auto rounded-md bg-transparent p-2 text-sm dark:text-gray-200 [&_img]:max-w-full"
          data-testid="readme-content"
        >
          <ReactMarkdown
            components={{ a: MarkdownLink }}
            // Hub cards are written in GitHub's dialect, not CommonMark: the
            // benchmark table every card ends with is the whole reason anyone
            // scrolls that far, and without this it is a paragraph of pipe
            // characters. What GFM adds — tables, task lists, strikethrough,
            // footnotes — is what the sanitize schema below was built around, so
            // it needs no widening to let this through.
            remarkPlugins={[remarkGfm]}
            // Order is the safety property: raw HTML becomes tree nodes first,
            // and the allow-list is applied to the result. Reversed, the
            // sanitiser would run over a tree the raw HTML is not yet part of
            // and pass everything.
            rehypePlugins={[
              rehypeRaw,
              [rehypeSanitize, modelCardSanitizeSchema],
            ]}
          >
            {splitModelCard(readme.content).body}
          </ReactMarkdown>
        </div>
      </>
    );
  };

  return (
    <ShowPage.Section title={t("model_registries.models.readme.title")}>
      {body()}
    </ShowPage.Section>
  );
};
