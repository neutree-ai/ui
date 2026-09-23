import { useCustom } from "@refinedev/core";
import { ListFilter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/foundation/lib/i18n";
import type { TestConnectivityResult } from "../hooks/use-test-connectivity";
import type { getUpstreamModelRequest } from "../lib/get-upstream-model-request";

type Props = {
  value: string;
  onChange: (value: string) => void;
  request?: ReturnType<typeof getUpstreamModelRequest>;
};

export default function UpstreamModelInput({
  value,
  onChange,
  request,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isFetching, isError } = useCustom<TestConnectivityResult>({
    url: "/external_endpoints/test_connectivity",
    method: "post",
    config: { payload: request },
    queryOptions: {
      enabled: open && !!request,
      retry: false,
      refetchOnWindowFocus: false,
      cacheTime: 0,
    },
    errorNotification: false,
    successNotification: false,
  });
  const failed = isError || data?.data.success === false;
  const models = [
    ...new Set(data?.data.success ? (data.data.models ?? []) : []),
  ];

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("external_endpoints.placeholders.upstreamModelName")}
        aria-label={t("external_endpoints.fields.upstreamModelName")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={!request}
            aria-label={t("external_endpoints.actions.selectUpstreamModel")}
            title={t("external_endpoints.actions.selectUpstreamModel")}
          >
            <ListFilter className="h-4 w-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command>
            <CommandInput
              aria-label={t(
                "external_endpoints.placeholders.searchUpstreamModels",
              )}
              placeholder={t(
                "external_endpoints.placeholders.searchUpstreamModels",
              )}
            />
            <CommandList
              aria-label={t("external_endpoints.fields.upstreamModelName")}
            >
              {isFetching ? (
                <p className="p-3 text-sm text-muted-foreground" role="status">
                  {t("loading")}
                </p>
              ) : failed ? (
                <p className="p-3 text-sm text-muted-foreground" role="status">
                  {t("external_endpoints.messages.modelListFailed")}
                </p>
              ) : (
                <>
                  <CommandEmpty>
                    {t("external_endpoints.messages.noModelSuggestions")}
                  </CommandEmpty>
                  <CommandGroup>
                    {models.map((model) => (
                      <CommandItem
                        key={model}
                        value={model}
                        onSelect={() => {
                          onChange(model);
                          setOpen(false);
                        }}
                      >
                        {model}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
