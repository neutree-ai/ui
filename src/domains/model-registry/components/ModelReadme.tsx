import "github-markdown-css/github-markdown-light.css";
import type { AnchorHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import { useRegistryModelReadme } from "@/domains/model-registry/hooks/use-registry-model-readme";
import { splitModelCard } from "@/domains/model-registry/lib/model-card";
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
 * public hub can write one — so it is treated as data all the way to the screen:
 *
 * - the server returns the markdown **as stored** and never renders it, so no
 *   HTML arrives that something else already decided to trust;
 * - `react-markdown` builds React elements from a parsed syntax tree. It has no
 *   `dangerouslySetInnerHTML` path unless `rehype-raw` is added, so raw HTML in
 *   the source — `<script>`, `<img onerror=…>`, `<iframe>` — is passed through as
 *   text rather than becoming markup. **Adding `rehype-raw` to this repo, here or
 *   anywhere, is what would break that**;
 * - link and image targets go through the library's default URL transform, which
 *   drops `javascript:` and other executable schemes, and links carry
 *   `rel="noreferrer nofollow"` so a card cannot pass this app's URL on as a
 *   referrer.
 *
 * Nothing here sanitises HTML, because nothing here ever produces any. That is
 * the whole argument, and it is why there is no allow-list to keep up to date.
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
          <ReactMarkdown components={{ a: MarkdownLink }}>
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
