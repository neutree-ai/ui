import { ListPage, Table, Combobox } from "@/components/theme";
import { Copy, Check } from "lucide-react";
import type { UseTableReturnType } from "@refinedev/react-table";
import { useCustomMutation, useInvalidate, useSelect } from "@refinedev/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "@refinedev/react-hook-form";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useApiKeyColumns } from "@/components/theme/table/columns/api-key-columns";
import type { ApiKey } from "@/types";

const CreateApiKeyForm = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const form = useForm({
    mode: "all",
    defaultValues: {
      name: "",
      workspace: "",
    },
  });
  const workspaces = useSelect({
    resource: "workspaces",
  });
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const onSubmit = async (formValue: { name: string; workspace: string }) => {
    const { data } = await mutateAsync({
      url: "/rpc/create_api_key",
      method: "post",
      values: {
        p_workspace: formValue.workspace,
        p_name: formValue.name,
        p_quota: 0,
      },
    });
    invalidate({
      resource: "api_keys",
      invalidates: ["list"],
    });
    setApiKey(data as ApiKey);
  };

  if (apiKey) {
    return (
      <div className="space-y-4">
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {t("api_keys.messages.createSuccess")}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="text-sm font-medium">
            {t("api_keys.fields.secretKey")}:
          </div>
          <div className="relative">
            <div className="p-3 bg-muted rounded-md border min-h-[60px] flex items-center">
              <code className="text-sm break-all font-mono leading-relaxed">
                {apiKey.status?.sk_value}
              </code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => {
                if (apiKey?.status?.sk_value) {
                  copyToClipboard(apiKey.status.sk_value);
                }
              }}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  {t("api_keys.buttons.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  {t("api_keys.buttons.copy")}
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            {t("api_keys.buttons.close")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          name="workspace"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>{t("api_keys.fields.workspace")}</FormLabel>
                <FormControl>
                  <Combobox
                    placeholder={t("api_keys.placeholders.selectWorkspace")}
                    disabled={workspaces.query.isLoading}
                    options={(workspaces.query.data?.data || []).map((e) => ({
                      label: e.metadata.name,
                      value: e.metadata.name,
                    }))}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            );
          }}
        />
        <FormField
          name="name"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>{t("api_keys.fields.name")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            );
          }}
        />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("api_keys.buttons.cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("api_keys.buttons.create")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const metadataColumns = useMetadataColumns();
  const apiKeyColumns = useApiKeyColumns();

  return (
    <ListPage
      createButtonProps={{
        onClick: () => {
          setOpen(true);
        },
      }}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("api_keys.create")}</DialogTitle>
            <DialogDescription>
              {t("api_keys.messages.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <CreateApiKeyForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Table enableSorting enableFilters>
        {metadataColumns.name}
        {metadataColumns.workspace}

        {metadataColumns.creation_timestamp}
        {apiKeyColumns.action}
      </Table>
    </ListPage>
  );
};
