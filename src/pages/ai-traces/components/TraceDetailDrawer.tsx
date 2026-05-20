import { useOne } from "@refinedev/core";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ShowButton } from "@/foundation/components/ShowButton";
import Timestamp from "@/foundation/components/Timestamp";
import type { AITrace } from "@/foundation/lib/api/ai-traces";
import { useTranslation } from "@/foundation/lib/i18n";

type Props = {
  trace: AITrace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const TraceDetailDrawer = ({ trace, open, onOpenChange }: Props) => {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[720px] sm:max-w-[720px] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>{t("ai_traces.detail.title")}</SheetTitle>
          <SheetDescription>{trace ? trace.request_id : null}</SheetDescription>
        </SheetHeader>

        {trace && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-6">
              <MetaGrid trace={trace} />
              <Separator />
              <BodySection
                title={t("ai_traces.detail.request")}
                body={trace.request_body}
              />
              <BodySection
                title={t("ai_traces.detail.response")}
                body={trace.response_body}
              />
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
};

const MetaGrid = ({ trace }: { trace: AITrace }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <MetaRow label={t("ai_traces.detail.time")}>
        <Timestamp timestamp={trace.time} format="YYYY-MM-DD HH:mm:ss" />
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.status")}>
        <Badge
          variant={
            trace.response_status >= 200 && trace.response_status < 300
              ? "default"
              : trace.response_status >= 400 && trace.response_status < 500
                ? "outline"
                : "destructive"
          }
        >
          {trace.response_status || "-"}
        </Badge>
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.endpoint")}>
        <EndpointLink
          name={trace.endpoint_name}
          type={trace.endpoint_type}
          workspace={trace.workspace}
        />
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.workspace")}>
        <WorkspaceLink name={trace.workspace} />
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.requestModel")}>
        {trace.request_model || "-"}
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.responseModel")}>
        {trace.response_model || "-"}
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.tokens")}>
        <TokenSummary trace={trace} />
      </MetaRow>
      <MetaRow label={t("ai_traces.detail.apiKey")}>
        <ApiKeyLink id={trace.api_key_id} workspace={trace.workspace} />
      </MetaRow>
    </div>
  );
};

const MetaRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span>{children}</span>
  </div>
);

const BodySection = ({ title, body }: { title: string; body?: string }) => {
  const pretty = formatBody(body);
  return (
    <div className="space-y-1">
      <h3 className="font-medium text-sm">{title}</h3>
      <pre className="text-xs bg-muted p-3 rounded font-mono whitespace-pre-wrap break-words">
        {pretty || <span className="text-muted-foreground">-</span>}
      </pre>
    </div>
  );
};

const TokenSummary = ({ trace }: { trace: AITrace }) => {
  const { t } = useTranslation();
  const fmt = (v?: number) => (v == null ? "-" : v.toLocaleString());
  return (
    <span className="text-xs">
      <span className="font-mono">{fmt(trace.prompt_tokens)}</span>{" "}
      {t("ai_traces.detail.tokenParts.prompt")}
      <span className="text-muted-foreground"> · </span>
      <span className="font-mono">{fmt(trace.completion_tokens)}</span>{" "}
      {t("ai_traces.detail.tokenParts.completion")}
      <span className="text-muted-foreground"> · </span>
      <span className="font-mono">{fmt(trace.total_tokens)}</span>{" "}
      {t("ai_traces.detail.tokenParts.total")}
    </span>
  );
};

const EndpointLink = ({
  name,
  type,
  workspace,
}: {
  name?: string;
  type?: string;
  workspace?: string;
}) => {
  if (!name) return <span className="text-muted-foreground">-</span>;
  if (!workspace) return <span>{name}</span>;
  const resource =
    type === "external-endpoint" ? "external_endpoints" : "endpoints";
  return (
    <span>
      <ShowButton
        resource={resource}
        recordItemId={name}
        meta={{ workspace }}
        variant="link"
        className="!h-auto !p-0"
      >
        {name}
      </ShowButton>
      {type ? (
        <span className="text-xs text-muted-foreground ml-2">({type})</span>
      ) : null}
    </span>
  );
};

const WorkspaceLink = ({ name }: { name?: string }) => {
  if (!name) return <span className="text-muted-foreground">-</span>;
  return (
    <ShowButton
      resource="workspaces"
      recordItemId={name}
      meta={{}}
      variant="link"
      className="!h-auto !p-0"
    >
      {name}
    </ShowButton>
  );
};

const ApiKeyLink = ({ id, workspace }: { id?: string; workspace?: string }) => {
  const enabled = Boolean(id && workspace);
  const { data } = useOne({
    resource: "api_keys",
    id: id ?? "",
    queryOptions: { enabled },
    meta: { workspace },
  });

  if (!id) return <span className="text-muted-foreground">-</span>;
  if (!workspace) {
    return <span className="font-mono text-xs">{id}</span>;
  }

  const name = (data?.data as { metadata?: { name?: string } } | undefined)
    ?.metadata?.name;

  // The api_keys show route is keyed by metadata.name, not the raw key id —
  // render a link only once the name has resolved, otherwise it 404s.
  if (!name) {
    return <span className="font-mono text-xs">{id}</span>;
  }

  return (
    <ShowButton
      resource="api_keys"
      recordItemId={name}
      meta={{ workspace }}
      variant="link"
      className="!h-auto !p-0 font-mono text-xs"
    >
      {name}
    </ShowButton>
  );
};

function formatBody(body?: string): string {
  if (!body) return "";
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      // not valid JSON — fall through
    }
  }
  return body;
}
