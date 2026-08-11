import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";

type ParameterEntries = Record<string, unknown> | null | undefined;

type EndpointAdvancedParametersProps = {
  engineParameters: ParameterEntries;
  environmentVariables: ParameterEntries;
};

const formatParameterValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

function ParameterValue({ name, value }: { name: string; value: unknown }) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();
  const displayValue = formatParameterValue(value);

  return (
    <TableRow>
      <TableCell className="w-[34%] max-w-0 font-mono text-xs">
        <span className="block truncate" title={name}>
          {name}
        </span>
      </TableCell>
      <TableCell className="max-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <code className="block truncate font-mono text-xs">
              {displayValue || "-"}
            </code>
          </TooltipTrigger>
          <TooltipContent className="max-w-lg break-all">
            {displayValue || "-"}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="w-12 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={t("api_keys.buttons.copy")}
          aria-label={`${name} ${t("api_keys.buttons.copy")}`}
          onClick={() =>
            copy(displayValue, {
              successMessage: t("components.apiKey.copySuccess"),
              errorMessage: t("components.apiKey.errors.copyFailed"),
            })
          }
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ParameterGroup({
  title,
  parameters,
}: {
  title: string;
  parameters: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(parameters);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {t("endpoints.messages.parameterCount", { count: entries.length })}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">
                {t("common.fields.name")}
              </TableHead>
              <TableHead>{t("endpoints.fields.parameterValue")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([name, value]) => (
              <ParameterValue key={name} name={name} value={value} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function EndpointAdvancedParameters({
  engineParameters,
  environmentVariables,
}: EndpointAdvancedParametersProps) {
  const { t } = useTranslation();
  const hasEngineParameters = Boolean(
    engineParameters && Object.keys(engineParameters).length,
  );
  const hasEnvironmentVariables = Boolean(
    environmentVariables && Object.keys(environmentVariables).length,
  );

  if (!hasEngineParameters && !hasEnvironmentVariables) return null;

  return (
    <ShowPage.Section title={t("endpoints.sections.advancedOptions")}>
      <div className="space-y-5">
        {hasEngineParameters && engineParameters && (
          <ParameterGroup
            title={t("endpoints.fields.engineVariables")}
            parameters={engineParameters}
          />
        )}
        {hasEnvironmentVariables && environmentVariables && (
          <div className={hasEngineParameters ? "border-t pt-4" : undefined}>
            <ParameterGroup
              title={t("endpoints.sections.environmentVariables")}
              parameters={environmentVariables}
            />
          </div>
        )}
      </div>
    </ShowPage.Section>
  );
}
