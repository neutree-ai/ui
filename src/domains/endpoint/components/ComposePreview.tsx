import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ComposedSpec } from "@/foundation/recipe/types";

type Props = {
  composed: ComposedSpec | null;
  error?: string | null;
};

const fmt = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

/**
 * ComposePreview shows the read-only result of `composeEndpointSpec` so the
 * operator can sanity-check what the endpoint will look like before submit.
 * It must visually match what the backend would produce — the algorithm is
 * the same on both sides.
 */
export const ComposePreview = ({ composed, error }: Props) => {
  const { t } = useTranslation();

  if (error) {
    return (
      <Card
        data-testid="compose-preview"
        data-state="error"
        className="mt-2 border-destructive/40"
      >
        <CardHeader>
          <CardTitle className="text-destructive">
            {t("endpoints.recipe.previewError", "Cannot compose")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive font-mono">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!composed) return null;

  const engineArgs = Object.entries(composed.engine_args ?? {});
  const env = Object.entries(composed.env ?? {});

  return (
    <Card data-testid="compose-preview" data-state="ok" className="mt-2">
      <CardHeader>
        <CardTitle>
          {t("endpoints.recipe.preview", "Composed preview")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row label={t("common.fields.model", "Model")}>
          {composed.model?.name ? (
            <span className="font-mono text-sm break-all">
              {composed.model.name}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>

        <Row label={t("common.fields.resources", "Resources")}>
          {composed.resources ? (
            <span className="font-mono text-sm">
              {`${composed.resources.cpu ?? 0} CPU · ${composed.resources.memory ?? 0} GiB · ${composed.resources.gpu ?? 0} GPU`}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>

        <Row label={t("endpoints.recipe.engineArgs", "Engine args")}>
          {engineArgs.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              {engineArgs.map(([k, v]) => (
                <div
                  key={k}
                  data-arg={k}
                  className="font-mono text-xs break-all"
                >
                  <span className="font-medium">{k}</span>
                  <span className="text-muted-foreground">: </span>
                  <span>{fmt(v)}</span>
                </div>
              ))}
            </div>
          )}
        </Row>

        <Row label={t("endpoints.recipe.env", "Environment")}>
          {env.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="space-y-1">
              {env.map(([k, v]) => (
                <div
                  key={k}
                  data-env={k}
                  className="flex items-baseline gap-2 text-sm"
                >
                  <Badge variant="secondary" className="font-mono">
                    {k}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground break-all">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Row>
      </CardContent>
    </Card>
  );
};

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="text-xs font-medium text-muted-foreground mb-1">
      {label}
    </div>
    {children}
  </div>
);
