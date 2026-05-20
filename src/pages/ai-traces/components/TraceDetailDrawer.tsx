import { useOne } from "@refinedev/core";
import {
  ChevronDown,
  ChevronUp,
  Search as SearchIcon,
  WrapText,
  X,
} from "lucide-react";
import { Fragment, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/foundation/lib/utils";

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
                kind="request"
              />
              <BodySection
                title={t("ai_traces.detail.response")}
                body={trace.response_body}
                kind="response"
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

type BodyKind = "request" | "response";
type ViewMode = "formatted" | "raw";

const BodySection = ({
  title,
  body,
  kind,
}: {
  title: string;
  body?: string;
  kind: BodyKind;
}) => {
  const { t } = useTranslation();
  const searchInputId = useId();

  const conversation = useMemo(
    () => parseConversation(body, kind),
    [body, kind],
  );
  const hasFormatted = conversation.length > 0;

  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<ViewMode>(
    hasFormatted ? "formatted" : "raw",
  );
  const [wrap, setWrap] = useState(false);
  const [query, setQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  const effectiveView: ViewMode = hasFormatted ? view : "raw";

  // Raw text used both for the raw view and for search match counting.
  const rawText = useMemo(() => formatBody(body), [body]);
  const formattedText = useMemo(
    () => (hasFormatted ? conversationToText(conversation) : ""),
    [conversation, hasFormatted],
  );
  const searchTarget = effectiveView === "formatted" ? formattedText : rawText;

  const matchCount = useMemo(
    () => countMatches(searchTarget, query),
    [searchTarget, query],
  );

  // Keep the active match index within bounds when the query/text changes.
  const safeActive =
    matchCount === 0 ? 0 : Math.min(activeMatch, matchCount - 1);

  const stepMatch = (delta: number) => {
    if (matchCount === 0) return;
    setActiveMatch((prev) => {
      const next = (prev + delta + matchCount) % matchCount;
      return next;
    });
  };

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(o) => setCollapsed(!o)}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1 -ml-1 font-medium text-sm"
            aria-label={
              collapsed
                ? t("ai_traces.detail.expand")
                : t("ai_traces.detail.collapse")
            }
          >
            {collapsed ? <ChevronUp className="rotate-180" /> : <ChevronDown />}
            {title}
          </Button>
        </CollapsibleTrigger>

        <div className="ml-auto flex items-center gap-1">
          {hasFormatted && (
            <div className="flex rounded-md border p-0.5">
              <ToggleChip
                active={effectiveView === "formatted"}
                onClick={() => setView("formatted")}
                label={t("ai_traces.detail.viewFormatted")}
              />
              <ToggleChip
                active={effectiveView === "raw"}
                onClick={() => setView("raw")}
                label={t("ai_traces.detail.viewRaw")}
              />
            </div>
          )}
          <Button
            type="button"
            variant={wrap ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setWrap((w) => !w)}
            title={
              wrap ? t("ai_traces.detail.noWrap") : t("ai_traces.detail.wrap")
            }
            aria-label={
              wrap ? t("ai_traces.detail.noWrap") : t("ai_traces.detail.wrap")
            }
          >
            <WrapText />
          </Button>
        </div>
      </div>

      <CollapsibleContent className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchInputId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveMatch(0);
              }}
              placeholder={t("ai_traces.detail.searchPlaceholder")}
              className="h-7 pl-7 pr-7 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveMatch(0);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("ai_traces.detail.noMatches")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {query && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {matchCount === 0
                  ? t("ai_traces.detail.noMatches")
                  : t("ai_traces.detail.matchCount", {
                      current: safeActive + 1,
                      total: matchCount,
                    })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={matchCount === 0}
                onClick={() => stepMatch(-1)}
                aria-label={t("ai_traces.detail.prevMatch")}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={matchCount === 0}
                onClick={() => stepMatch(1)}
                aria-label={t("ai_traces.detail.nextMatch")}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {effectiveView === "formatted" ? (
          <ConversationView
            messages={conversation}
            query={query}
            activeMatch={safeActive}
            wrap={wrap}
          />
        ) : (
          <RawView
            text={rawText}
            query={query}
            activeMatch={safeActive}
            wrap={wrap}
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ToggleChip = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded px-2 py-0.5 text-xs transition-colors",
      active
        ? "bg-secondary text-secondary-foreground font-medium"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {label}
  </button>
);

const RawView = ({
  text,
  query,
  activeMatch,
  wrap,
}: {
  text: string;
  query: string;
  activeMatch: number;
  wrap: boolean;
}) => (
  <pre
    className={cn(
      "text-xs bg-muted p-3 rounded font-mono",
      wrap
        ? "whitespace-pre-wrap break-words"
        : "whitespace-pre overflow-x-auto",
    )}
  >
    {text ? (
      <Highlighted text={text} query={query} activeMatch={activeMatch} />
    ) : (
      <span className="text-muted-foreground">-</span>
    )}
  </pre>
);

const ConversationView = ({
  messages,
  query,
  activeMatch,
  wrap,
}: {
  messages: ChatMessage[];
  query: string;
  activeMatch: number;
  wrap: boolean;
}) => {
  // Match indices are assigned in document order across every rendered text
  // node, so we accumulate a running offset as we walk the messages.
  let cursor = 0;
  return (
    <div className="space-y-2">
      {messages.map((msg, mi) => {
        const blocks = msg.blocks.map((block, bi) => {
          const occ = countMatches(block.text, query);
          const node = (
            <BlockView
              key={`${mi}-${bi}`}
              block={block}
              query={query}
              activeMatch={activeMatch - cursor}
              wrap={wrap}
            />
          );
          cursor += occ;
          return node;
        });
        return (
          <div key={mi} className="rounded border bg-muted/40 overflow-hidden">
            <div className="border-b bg-muted px-3 py-1.5">
              <RoleBadge role={msg.role} />
            </div>
            <div className="space-y-2 p-3">{blocks}</div>
          </div>
        );
      })}
    </div>
  );
};

const RoleBadge = ({ role }: { role: string }) => {
  const { t } = useTranslation();
  const known = ["system", "user", "assistant", "tool", "developer"];
  const label = known.includes(role)
    ? t(`ai_traces.detail.role.${role}`)
    : role;
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
};

const BlockView = ({
  block,
  query,
  activeMatch,
  wrap,
}: {
  block: ContentBlock;
  query: string;
  activeMatch: number;
  wrap: boolean;
}) => {
  const { t } = useTranslation();
  const labelKey =
    block.kind === "tool_use"
      ? "ai_traces.detail.block.toolUse"
      : block.kind === "tool_result"
        ? "ai_traces.detail.block.toolResult"
        : block.kind === "image"
          ? "ai_traces.detail.block.image"
          : block.kind === "thinking"
            ? "ai_traces.detail.block.thinking"
            : block.kind === "text"
              ? "ai_traces.detail.block.text"
              : "ai_traces.detail.block.unknown";

  return (
    <div className="space-y-1">
      {block.kind !== "text" && (
        <div className="text-[11px] font-medium text-muted-foreground">
          {t(labelKey)}
          {block.label ? `: ${block.label}` : ""}
        </div>
      )}
      <pre
        className={cn(
          "text-xs font-mono leading-relaxed",
          wrap
            ? "whitespace-pre-wrap break-words"
            : "whitespace-pre overflow-x-auto",
        )}
      >
        <Highlighted
          text={block.text}
          query={query}
          activeMatch={activeMatch}
        />
      </pre>
    </div>
  );
};

/** Splits `text` on `query` and wraps every occurrence in a <mark>. */
const Highlighted = ({
  text,
  query,
  activeMatch,
}: {
  text: string;
  query: string;
  activeMatch: number;
}) => {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let idx = lower.indexOf(needle, from);
  let n = 0;
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    const segment = text.slice(idx, idx + needle.length);
    const isActive = n === activeMatch;
    parts.push(
      <mark
        key={`${idx}-${n}`}
        data-active={isActive ? "true" : undefined}
        ref={
          isActive
            ? (el) => {
                el?.scrollIntoView({ block: "nearest", inline: "nearest" });
              }
            : undefined
        }
        className={cn(
          "rounded-sm",
          isActive ? "bg-orange-400 text-black" : "bg-yellow-300/70 text-black",
        )}
      >
        {segment}
      </mark>,
    );
    from = idx + needle.length;
    idx = lower.indexOf(needle, from);
    n += 1;
  }
  if (from < text.length) parts.push(text.slice(from));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
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

function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let count = 0;
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = lower.indexOf(needle, idx + needle.length);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Conversation parsing
// ---------------------------------------------------------------------------

type ContentBlock = {
  kind: "text" | "tool_use" | "tool_result" | "image" | "thinking" | "unknown";
  text: string;
  label?: string;
};

type ChatMessage = {
  role: string;
  blocks: ContentBlock[];
};

/**
 * Builds a readable conversation from a trace body.
 * - request: parses OpenAI Chat Completions / Anthropic Messages `messages`.
 * - response: parses a JSON response or a concatenated SSE stream.
 * Returns an empty array when no formatted view is possible.
 */
function parseConversation(
  body: string | undefined,
  kind: BodyKind,
): ChatMessage[] {
  if (!body) return [];
  const trimmed = body.trim();
  if (!trimmed) return [];

  const json = tryParseJSON(trimmed);
  if (json !== undefined) {
    return kind === "request"
      ? parseRequestJSON(json)
      : parseResponseJSON(json);
  }

  // Not JSON — for responses, attempt to read an SSE stream.
  if (kind === "response" && trimmed.includes("data:")) {
    return parseSSEResponse(trimmed);
  }
  return [];
}

function tryParseJSON(text: string): unknown {
  if (!(text.startsWith("{") || text.startsWith("["))) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseRequestJSON(json: unknown): ChatMessage[] {
  if (!isRecord(json)) return [];
  const messages = json.messages;
  if (!Array.isArray(messages)) return [];
  const result: ChatMessage[] = [];

  // Anthropic carries a top-level `system` outside the messages array.
  if (typeof json.system === "string" && json.system.trim()) {
    result.push({
      role: "system",
      blocks: [{ kind: "text", text: json.system }],
    });
  } else if (Array.isArray(json.system)) {
    result.push({ role: "system", blocks: normalizeContent(json.system) });
  }

  for (const m of messages) {
    if (!isRecord(m)) continue;
    const role = typeof m.role === "string" ? m.role : "unknown";
    result.push({ role, blocks: normalizeContent(m.content) });
  }
  return result;
}

function parseResponseJSON(json: unknown): ChatMessage[] {
  if (!isRecord(json)) return [];

  // OpenAI Chat Completions: choices[].message
  if (Array.isArray(json.choices)) {
    const out: ChatMessage[] = [];
    for (const choice of json.choices) {
      if (!isRecord(choice)) continue;
      const message = choice.message ?? choice.delta;
      if (isRecord(message)) {
        const role =
          typeof message.role === "string" ? message.role : "assistant";
        const blocks = normalizeContent(message.content);
        if (isRecord(message.tool_calls) || Array.isArray(message.tool_calls)) {
          for (const tc of asArray(message.tool_calls)) {
            blocks.push(toolCallBlock(tc));
          }
        }
        if (blocks.length > 0) out.push({ role, blocks });
      }
    }
    if (out.length > 0) return out;
  }

  // Anthropic Messages response: top-level role + content array
  if (json.role === "assistant" || Array.isArray(json.content)) {
    const role = typeof json.role === "string" ? json.role : "assistant";
    const blocks = normalizeContent(json.content);
    if (blocks.length > 0) return [{ role, blocks }];
  }

  return [];
}

function parseSSEResponse(text: string): ChatMessage[] {
  const lines = text.split(/\r?\n/);
  let assistant = "";
  const toolBlocks: ContentBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    const evt = tryParseJSON(payload);
    if (!isRecord(evt)) continue;

    // OpenAI streaming delta
    if (Array.isArray(evt.choices)) {
      for (const choice of evt.choices) {
        if (!isRecord(choice)) continue;
        const delta = choice.delta;
        if (isRecord(delta) && typeof delta.content === "string") {
          assistant += delta.content;
        }
      }
      continue;
    }

    // Anthropic streaming events
    if (evt.type === "content_block_delta" && isRecord(evt.delta)) {
      const d = evt.delta;
      if (typeof d.text === "string") assistant += d.text;
      else if (typeof d.partial_json === "string") assistant += d.partial_json;
    }
  }

  const blocks: ContentBlock[] = [];
  if (assistant) blocks.push({ kind: "text", text: assistant });
  blocks.push(...toolBlocks);
  return blocks.length > 0 ? [{ role: "assistant", blocks }] : [];
}

function normalizeContent(content: unknown): ContentBlock[] {
  if (content == null) return [];
  if (typeof content === "string") {
    return content ? [{ kind: "text", text: content }] : [];
  }
  if (Array.isArray(content)) {
    const blocks: ContentBlock[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        if (item) blocks.push({ kind: "text", text: item });
        continue;
      }
      if (!isRecord(item)) continue;
      blocks.push(blockFromRecord(item));
    }
    return blocks;
  }
  // Unknown shape — stringify.
  return [{ kind: "unknown", text: stringify(content) }];
}

function blockFromRecord(item: Record<string, unknown>): ContentBlock {
  const type = typeof item.type === "string" ? item.type : "";
  switch (type) {
    case "text":
      return { kind: "text", text: asText(item.text) };
    case "input_text":
    case "output_text":
      return { kind: "text", text: asText(item.text) };
    case "thinking":
      return { kind: "thinking", text: asText(item.thinking ?? item.text) };
    case "image":
    case "image_url":
      return { kind: "image", text: stringify(item.source ?? item.image_url) };
    case "tool_use":
      return {
        kind: "tool_use",
        label: typeof item.name === "string" ? item.name : undefined,
        text: stringify(item.input ?? {}),
      };
    case "tool_result":
      return {
        kind: "tool_result",
        label:
          typeof item.tool_use_id === "string" ? item.tool_use_id : undefined,
        text: normalizeToolResultContent(item.content),
      };
    default:
      return { kind: "unknown", text: stringify(item) };
  }
}

function toolCallBlock(tc: unknown): ContentBlock {
  if (!isRecord(tc)) return { kind: "tool_use", text: stringify(tc) };
  const fn = isRecord(tc.function) ? tc.function : undefined;
  const name =
    fn && typeof fn.name === "string"
      ? fn.name
      : typeof tc.name === "string"
        ? tc.name
        : undefined;
  const args = fn ? fn.arguments : tc.arguments;
  return {
    kind: "tool_use",
    label: name,
    text: typeof args === "string" ? args : stringify(args ?? {}),
  };
}

function normalizeToolResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        isRecord(c) && typeof c.text === "string" ? c.text : stringify(c),
      )
      .join("\n");
  }
  return stringify(content);
}

function conversationToText(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role}\n${m.blocks.map((b) => b.text).join("\n")}`)
    .join("\n\n");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asText(v: unknown): string {
  return typeof v === "string" ? v : stringify(v);
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
