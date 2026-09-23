import { Check, Copy, Maximize2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
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

/** The value as the reader needs it once the cell has cut it off.
 *
 * One line is all a table cell can hold, so the cell shows the compact form and
 * this is what the hover card shows: JSON indented, everything else as written.
 * A string carrying JSON counts as JSON — that is how these values are pasted
 * in, and indenting them is the whole point of the card. */
const formatParameterValueExpanded = (value: unknown) => {
  const structured = toStructuredValue(value);
  if (structured === undefined) return formatParameterValue(value);

  try {
    return JSON.stringify(structured, null, 2);
  } catch {
    return formatParameterValue(value);
  }
};

/** Objects and arrays, or a string holding one. Primitives are left alone:
 * "8192" and "true" gain nothing from being reparsed and reprinted. */
const toStructuredValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

/** Floating panel for one parameter: the value in full, JSON indented.
 *
 * Same shape as the engine schema table's row panel — name line, then the
 * content in a bordered well — so a reader who has opened one recognises the
 * other. The two are separate implementations on purpose; they are meant to be
 * extracted into one component once both tables have landed. */
function ParameterValueDetails({
  name,
  value,
}: {
  name: string;
  value: unknown;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{name}</span>
      </div>
      <pre className="max-h-[40vh] overflow-auto rounded-md border bg-[var(--nt-fill-neutral-opaque-1)] p-3 font-mono text-xs leading-5 text-foreground">
        {formatParameterValueExpanded(value) || "-"}
      </pre>
    </div>
  );
}

function ParameterValue({ name, value }: { name: string; value: unknown }) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();
  const displayValue = formatParameterValue(value);
  const valueRef = useRef<HTMLElement>(null);
  const valueTruncated = useIsTruncated(valueRef);

  return (
    <TableRow>
      <TableCell className="w-[34%] max-w-0 font-mono text-xs">
        <span className="block truncate" title={name}>
          {name}
        </span>
      </TableCell>
      <TableCell className="max-w-0">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <code ref={valueRef} className="block truncate font-mono text-xs">
              {displayValue || "-"}
            </code>
          </div>
          {/* Only a value that is actually cut off gets the control: the button
              is the affordance, so it has to mean "there is more". Same
              treatment as the engine schema table. */}
          {valueTruncated ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-[var(--nt-text-neutral-quaternary)] hover:text-[var(--nt-text-neutral-secondary)]"
                  aria-label={t("endpoints.messages.expandParameterValue", {
                    name,
                  })}
                >
                  <Maximize2 className="size-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px]">
                <ParameterValueDetails name={name} value={value} />
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
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
