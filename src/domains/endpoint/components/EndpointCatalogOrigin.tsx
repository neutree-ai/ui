import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CatalogOrigin,
  readCatalogOrigin,
} from "@/domains/endpoint/lib/catalog-origin";
import { ShowButton } from "@/foundation/components/ShowButton";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * What an endpoint was deployed from, read back off the endpoint itself.
 *
 * Read-only, and deliberately so: the catalog it names may have changed or
 * been deleted since, so this states what happened rather than offering to
 * re-derive anything from it. Nothing here fetches the catalog — a record that
 * still reads correctly after the catalog is gone is the point.
 */
export const EndpointCatalogOrigin = ({
  annotations,
}: {
  annotations: Record<string, string> | null | undefined;
}) => {
  const { t } = useTranslation();
  const origin: CatalogOrigin | null = readCatalogOrigin(annotations);

  if (!origin) return null;

  return (
    <div data-testid="endpoint-catalog-origin" className="space-y-1">
      <div className="text-xs text-muted-foreground">
        {t("endpoints.fields.modelCatalog")}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium break-all">{origin.catalog}</span>
        {origin.variant && (
          <Badge variant="secondary" className="font-mono">
            {origin.variant}
          </Badge>
        )}
        {origin.features.map((feature) => (
          <Badge
            key={feature.name}
            variant="outline"
            className="font-mono"
            data-feature={feature.name}
          >
            {feature.value === undefined
              ? feature.name
              : `${feature.name}: ${feature.value}`}
          </Badge>
        ))}
        {origin.featuresUnreadable && (
          <span className="text-xs text-muted-foreground">
            {t("endpoints.origin.featuresUnreadable")}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("endpoints.origin.hint")}
      </p>
    </div>
  );
};

EndpointCatalogOrigin.displayName = "EndpointCatalogOrigin";

/**
 * The same record, compact enough for a header line: the catalog by name,
 * linked so it is one click away, with the variant left to a tooltip.
 *
 * The link follows the recorded name and nothing else, so a catalog deleted
 * since lands on its not-found page rather than being hidden here.
 */
export const EndpointCatalogOriginLink = ({
  origin,
  workspace,
}: {
  origin: CatalogOrigin;
  workspace: string | null | undefined;
}) => {
  const { t } = useTranslation();

  const link = (
    <ShowButton
      recordItemId={origin.catalog}
      meta={{ workspace }}
      variant="link"
      resource="model_catalogs"
    >
      {origin.catalog}
    </ShowButton>
  );

  if (!origin.variant) return link;

  return (
    <Tooltip>
      {/* ShowButton forwards no ref, so the trigger needs an element of its
      own to anchor to. */}
      <TooltipTrigger asChild>
        <span>{link}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t("endpoints.origin.variant", { variant: origin.variant })}
      </TooltipContent>
    </Tooltip>
  );
};

EndpointCatalogOriginLink.displayName = "EndpointCatalogOriginLink";
