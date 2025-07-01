import { useOemConfigForm } from "@/pages/oem-config/use-oem-config-form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Form } from "@/components/theme";
import { useTranslation } from "@/lib/i18n";
import { useOemConfig } from "@/hooks/use-oem-config";
import { Loader2 } from "lucide-react";

export function OemConfigShow() {
  const { oemConfig, isLoading } = useOemConfig();

  const { form, formFields } = useOemConfigForm({
    action: oemConfig ? "edit" : "create",
  });
  const { t } = useTranslation();

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  return (
    <div className="p-2 mx-auto space-y-2">
      <div>
        <p className="text-muted-foreground">{t("oem_configs.description")}</p>
      </div>

      <Form {...form} hideCancel>
        <Card>
          <CardHeader>
            <CardTitle>{t("oem_configs.fields.brandSettings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{formFields}</CardContent>
        </Card>
      </Form>
    </div>
  );
}
