import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/foundation/components/Disclosure";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { KeyValueList } from "@/foundation/components/KeyValueList";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ComposedSpec } from "@/foundation/recipe/types";

type Props = {
  composed: ComposedSpec | null;
  error?: string | null;
  /**
   * Start as a one-line summary the user can open.
   *
   * Wanted where the raw fields are folded away: a recipe deploy otherwise
   * gives no way to see which engine and arguments it is about to run, and
   * asking someone to expand "Show all options" to find out defeats the point
   * of the simplified form. Read-only, so it adds no decision — only the
   * result of the ones already made.
   */
  collapsible?: boolean;
  /** Keep object values in one column in the narrow summary rail. */
  compact?: boolean;
  /** Match the surface of the surrounding summary or standalone form. */
  surface?: "card" | "plain";
};

/**
 * ComposePreview shows the read-only result of `composeEndpointSpec` so the
 * operator can sanity-check what the endpoint will look like before submit.
 * It must visually match what the backend would produce — the algorithm is
 * the same on both sides.
 */
export const ComposePreview = ({
  composed,
  error,
  collapsible,
  compact = false,
  surface = "card",
}: Props) => {
  const { t } = useTranslation();

  if (error) {
    if (surface === "plain") {
      return (
        <div
          data-testid="compose-preview"
          data-state="error"
          className="border-l-2 border-destructive px-3 py-2"
        >
          <div className="text-sm font-medium text-destructive">
            {t("endpoints.recipe.previewError", "Cannot compose")}
          </div>
          <div className="mt-1 text-sm font-mono text-destructive">{error}</div>
        </div>
      );
    }
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

  const engineLabel = composed.engine?.engine
    ? [composed.engine.engine, composed.engine.version]
        .filter(Boolean)
        .join(" ")
    : null;

  // What the deploy will actually run, in one line: the engine, the interface
  // it exposes, and how much was configured. Enough to notice a wrong variant
  // without opening anything.
  const summary = [
    engineLabel,
    composed.model?.task,
    t("endpoints.recipe.engineArgCount", { count: engineArgs.length }),
    env.length > 0
      ? t("endpoints.recipe.envCount", { count: env.length })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <>
      <Row label={t("common.fields.engine", "Engine")}>
        {engineLabel ? (
          <span className="font-mono text-sm">{engineLabel}</span>
        ) : (
          <EmptyValue />
        )}
      </Row>

      <Row label={t("common.fields.model", "Model")}>
        {composed.model?.name ? (
          <span className="font-mono text-sm break-all">
            {composed.model.name}
            {composed.model.task ? (
              <span className="text-muted-foreground">
                {` · ${composed.model.task}`}
              </span>
            ) : null}
          </span>
        ) : (
          <EmptyValue />
        )}
      </Row>

      <Row label={t("common.fields.resources", "Resources")}>
        {composed.resources ? (
          <span className="font-mono text-sm">
            {`${composed.resources.cpu ?? 0} CPU · ${composed.resources.memory ?? 0} GiB · ${composed.resources.gpu ?? 0} GPU`}
          </span>
        ) : (
          <EmptyValue />
        )}
      </Row>

      <Row label={t("endpoints.recipe.engineArgs", "Engine args")}>
        {engineArgs.length === 0 ? (
          <EmptyValue />
        ) : (
          <KeyValueList entries={engineArgs} compact={compact} />
        )}
      </Row>

      <Row label={t("endpoints.recipe.env", "Environment")}>
        {env.length === 0 ? (
          <EmptyValue />
        ) : (
          <KeyValueList entries={env} compact={compact} />
        )}
      </Row>
    </>
  );

  if (!collapsible) {
    if (surface === "plain") {
      return (
        <div
          data-testid="compose-preview"
          data-state="ok"
          className="space-y-4"
        >
          {content}
        </div>
      );
    }
    return (
      <Card data-testid="compose-preview" data-state="ok" className="mt-2">
        <CardHeader>
          <CardTitle>
            {t("endpoints.recipe.preview", "Composed preview")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{content}</CardContent>
      </Card>
    );
  }

  return (
    <Disclosure
      variant={surface}
      title={t("endpoints.recipe.preview", "Composed preview")}
      summary={summary}
      testId="compose-preview"
      dataState="ok"
      triggerTestId="compose-preview-toggle"
      className={surface === "card" ? "mt-2" : undefined}
    >
      <div className="space-y-4">{content}</div>
    </Disclosure>
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
