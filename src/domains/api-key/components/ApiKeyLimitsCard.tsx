import { useForm } from "@refinedev/react-hook-form";
import { useCallback, useEffect, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { ApiKeyPolicyFields } from "@/domains/api-key/components/ApiKeyPolicyFields";
import {
  type AccessRow,
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  policyRowsToForm,
  type QuotaRow,
  summarizeApiKeyLimits,
  useApiKeyLimits,
} from "@/domains/api-key/hooks/use-api-key-policy";

// Editable Limits panel on the API key detail page: shows the key's current
// limits and lets you edit them in place (Save upserts changed limits and
// removes cleared ones).
export const ApiKeyLimitsCard = ({ apiKeyId }: { apiKeyId: string }) => {
  const { t } = useTranslation();
  const { load, save } = useApiKeyLimits();
  const [loaded, setLoaded] = useState<{
    quotaRows: QuotaRow[];
    accessRows: AccessRow[];
  }>({ quotaRows: [], accessRows: [] });
  const form = useForm<ApiKeyPolicyFormValues>({
    mode: "all",
    defaultValues: apiKeyPolicyDefaults(),
  });

  const refresh = useCallback(async () => {
    const rows = await load(apiKeyId);
    setLoaded(rows);
    form.reset(policyRowsToForm(rows.quotaRows, rows.accessRows));
  }, [load, apiKeyId, form]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = summarizeApiKeyLimits(loaded.quotaRows, loaded.accessRows);

  const onSave = async (values: FieldValues) => {
    await save(apiKeyId, values as ApiKeyPolicyFormValues, loaded);
    await refresh();
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">
          {t("api_keys.limits.sectionTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {summary.length > 0 ? summary.join(" · ") : t("api_keys.limits.none")}
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <ApiKeyPolicyFields form={form} />
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("buttons.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
