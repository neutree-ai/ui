import { Badge } from "@/components/ui/badge";
import {
  type CatalogOrigin,
  readCatalogOrigin,
} from "@/domains/endpoint/lib/catalog-origin";
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
