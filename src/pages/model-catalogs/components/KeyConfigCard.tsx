import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

// Curated set of engine arguments highlighted in the catalog detail view —
// these are the levers operators most often care about (parallelism, context,
// quantization, structured-output parsers, accelerated decoding).
// Anything else stays in the Advanced section.
type Props = {
  variables: Record<string, any> | null;
};

const fmt = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

export const KeyConfigCard = ({ variables }: Props) => {
  const { t } = useTranslation();

  // Some templates put engine flags directly under `variables`; others nest
  // them under `engine_args`. Merge both shapes so the panel works either way.
  const flat: Record<string, any> = {
    ...(variables ?? {}),
    ...((variables?.engine_args as Record<string, any>) ?? {}),
  };

  const bool = (key: string): string | undefined => {
    const v = flat[key];
    if (v === undefined || v === null) return undefined;
    return v ? "✓" : "✗";
  };

  const rows: Array<{ label: string; value: string }> = [];

  const push = (label: string, value: string | undefined) => {
    if (value && value !== "") rows.push({ label, value });
  };

  push(t("model_catalogs.keyConfig.contextLength"), fmt(flat.max_model_len));
  push(
    t("model_catalogs.keyConfig.tensorParallel"),
    fmt(flat.tensor_parallel_size),
  );
  push(
    t("model_catalogs.keyConfig.dataParallel"),
    fmt(flat.data_parallel_size),
  );
  push(
    t("model_catalogs.keyConfig.pipelineParallel"),
    fmt(flat.pipeline_parallel_size),
  );
  push(
    t("model_catalogs.keyConfig.expertParallel"),
    bool("enable_expert_parallel"),
  );
  push(t("model_catalogs.keyConfig.quantization"), fmt(flat.quantization));
  push(t("model_catalogs.keyConfig.kvCacheDtype"), fmt(flat.kv_cache_dtype));
  push(
    t("model_catalogs.keyConfig.reasoningParser"),
    fmt(flat.reasoning_parser),
  );
  push(t("model_catalogs.keyConfig.toolParser"), fmt(flat.tool_call_parser));
  push(
    t("model_catalogs.keyConfig.prefixCaching"),
    bool("enable_prefix_caching"),
  );
  push(t("model_catalogs.keyConfig.speculative"), fmt(flat.speculative_config));

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("model_catalogs.sections.keyConfig")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {rows.map((row) => (
            <ShowPage.Row key={row.label} title={row.label}>
              <span className="font-mono text-xs break-all">{row.value}</span>
            </ShowPage.Row>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

type EnvCardProps = {
  env: Record<string, string> | null;
};

export const EnvCard = ({ env }: EnvCardProps) => {
  const { t } = useTranslation();
  const entries = env ? Object.entries(env) : [];
  if (entries.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("model_catalogs.sections.env")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 text-sm">
              <Badge variant="secondary" className="font-mono">
                {k}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground break-all">
                {v}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
