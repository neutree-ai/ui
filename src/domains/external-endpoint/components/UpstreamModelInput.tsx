import { useCustom } from "@refinedev/core";
import { ChevronDown, CircleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";
import type { TestConnectivityResult } from "../hooks/use-test-connectivity";
import type { getUpstreamModelRequest } from "../lib/get-upstream-model-request";

type Props = {
  value: string;
  onChange: (value: string) => void;
  request?: ReturnType<typeof getUpstreamModelRequest>;
};

function useUpstreamModels(request: Props["request"], enabled = false) {
  return useCustom<TestConnectivityResult>({
    url: "/external_endpoints/test_connectivity",
    method: "post",
    config: { payload: request },
    queryOptions: {
      enabled: enabled && !!request,
      retry: false,
      keepPreviousData: false,
      refetchOnWindowFocus: false,
      cacheTime: 0,
    },
    errorNotification: false,
    successNotification: false,
  });
}

export function UpstreamConnectionWarning({ request }: Pick<Props, "request">) {
  const { t } = useTranslation();
  // Observe the same query as the model input; no extra request or copied error state.
  const { data, isError, isFetching } = useUpstreamModels(request);
  if (!request || isFetching || (!isError && data?.data.success !== false))
    return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="shrink-0 text-destructive"
            aria-label={t(
              "external_endpoints.messages.upstreamConnectionFailed",
            )}
          >
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("external_endpoints.messages.upstreamConnectionFailed")}</p>
          <p>{t("external_endpoints.messages.checkUpstreamConnection")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function UpstreamModelInput({
  value,
  onChange,
  request,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const listId = useId();
  const { data, isFetching, isError } = useUpstreamModels(request, open);
  const failed = isError || data?.data.success === false;
  const models = [
    ...new Set(data?.data.success ? (data.data.models ?? []) : []),
  ];

  const filtered = models.filter((model) =>
    model.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = open && !!request;
  const selected = !isFetching && !failed ? filtered[active] : undefined;
  const expand = () => {
    setSearch("");
    setActive(-1);
    setOpen(true);
  };

  return (
    <Popover open={visible} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative min-w-0 w-full">
          <Input
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={visible}
            aria-controls={visible ? listId : undefined}
            aria-activedescendant={
              visible && selected ? `${listId}-${active}` : undefined
            }
            aria-label={t("external_endpoints.fields.upstreamModelName")}
            placeholder={t("external_endpoints.placeholders.upstreamModelName")}
            className="pr-8"
            value={value}
            onFocus={expand}
            onClick={() => {
              if (!open) expand();
            }}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              onChange(event.target.value);
              setSearch(event.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActive((current) =>
                  event.key === "ArrowDown"
                    ? Math.min(current + 1, filtered.length - 1)
                    : Math.max(current - 1, 0),
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (visible && selected) onChange(selected);
                setOpen(false);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (
            event.target instanceof Element &&
            event.target.getAttribute("aria-controls") === listId
          )
            event.preventDefault();
        }}
      >
        <div
          id={listId}
          role="listbox"
          aria-label={t("external_endpoints.fields.upstreamModelName")}
          className="min-h-8 max-h-60 overflow-y-auto"
        >
          {isFetching ? (
            <p className="p-3 text-sm text-muted-foreground" role="status">
              {t("loading")}
            </p>
          ) : (
            filtered.map((model, index) => (
              <button
                type="button"
                tabIndex={-1}
                key={model}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`w-full text-left cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${index === active ? "bg-accent" : ""}`}
                ref={(element) => {
                  if (index === active)
                    element?.scrollIntoView({ block: "nearest" });
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
              >
                {model}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
