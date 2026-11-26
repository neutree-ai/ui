import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormControl, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/foundation/lib/i18n";
import { FormSelect } from "@/foundation/role/FormSelect";
import type { UpstreamType } from "../lib/derive-upstream-type";
import { quickUpstream } from "../lib/external-endpoint-form-upstreams";
import type { UpstreamSpec } from "../types";
import { type EndpointOption, EndpointRefSelect } from "./EndpointRefSelect";

import UpstreamNameLabel from "./UpstreamNameLabel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
  endpointOptions: EndpointOption[];
  onCreate: (name: string, upstream: UpstreamSpec) => void;
};

export default function QuickUpstreamDialog({
  open,
  onOpenChange,
  onCreate,
  existingNames,
  endpointOptions,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<UpstreamType>("external");
  const [url, setUrl] = useState("");
  const [endpointRef, setEndpointRef] = useState("");
  const [credential, setCredential] = useState("");

  const reset = () => {
    setName("");
    setType("external");
    setUrl("");
    setEndpointRef("");
    setCredential("");
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const duplicateName = existingNames.includes(name.trim());

  const canCreate =
    !duplicateName &&
    !!name.trim() &&
    (type === "external"
      ? !!url.trim()
      : endpointOptions.some((option) => option.value === endpointRef));

  const submit = () => {
    if (!canCreate) return;
    onCreate(
      name.trim(),
      quickUpstream(type, { url: url.trim(), endpointRef, credential }),
    );
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("external_endpoints.quickCreate.title")}</DialogTitle>
          <DialogDescription>
            {t("external_endpoints.quickCreate.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormItem className="grid gap-2 space-y-0 text-sm text-muted-foreground">
            <UpstreamNameLabel />
            <FormControl>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("external_endpoints.placeholders.provider")}
                autoFocus
              />
            </FormControl>
            {duplicateName && (
              <p className="text-destructive">
                {t("external_endpoints.validation.duplicateProvider")}
              </p>
            )}
          </FormItem>
          <div className="grid gap-2 text-sm text-muted-foreground">
            {t("external_endpoints.fields.upstreamType")}
            <FormSelect
              value={type}
              onChange={(value) => setType(value as UpstreamType)}
              options={[
                {
                  label: t("external_endpoints.options.upstreamTypeExternal"),
                  value: "external",
                },
                {
                  label: t(
                    "external_endpoints.options.upstreamTypeEndpointRef",
                  ),
                  value: "endpoint_ref",
                },
              ]}
            />
          </div>
          <FormItem className="grid gap-2 space-y-0 text-sm text-muted-foreground">
            <FormLabel>
              {type === "external"
                ? t("external_endpoints.fields.upstreamUrl")
                : t("external_endpoints.fields.endpointRef")}
            </FormLabel>
            {type === "external" ? (
              <FormControl>
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={t("external_endpoints.placeholders.upstreamUrl")}
                />
              </FormControl>
            ) : (
              <EndpointRefSelect
                options={endpointOptions}
                value={endpointRef}
                onChange={(value) => setEndpointRef(String(value))}
              />
            )}
          </FormItem>
          {type === "external" && (
            <div className="grid gap-2 text-sm text-muted-foreground">
              {t("external_endpoints.fields.credential")}
              <Input
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder={t("external_endpoints.placeholders.credential")}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {t("buttons.cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={!canCreate}>
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
