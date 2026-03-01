import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ApiKey } from "@/domains/api-key/types";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useCustomMutation, useInvalidate, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";

type FormValues = { name: string; workspace: string };

export const CreateApiKeyForm = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const form = useForm<FormValues>({
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
  const { copy, copied } = useCopyToClipboard();

  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();

  const handleCopy = (text: string) =>
    copy(text, {
      successMessage: t("components.apiKey.copySuccess"),
      successDescription: t("components.apiKey.copySuccessDescription"),
      errorMessage: t("components.apiKey.errors.copyFailed"),
    });

  const onSubmit = async (formValue: FieldValues) => {
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
                  handleCopy(apiKey.status.sk_value);
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
            {t("buttons.close")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormFieldGroup
          {...form}
          name="workspace"
          label={t("common.fields.workspace")}
        >
          <FormCombobox
            placeholder={t("api_keys.placeholders.selectWorkspace")}
            disabled={workspaces.query.isLoading}
            options={(workspaces.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
          />
        </FormFieldGroup>
        <FormFieldGroup {...form} name="name" label={t("common.fields.name")}>
          <Input />
        </FormFieldGroup>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("buttons.cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("api_keys.buttons.create")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
