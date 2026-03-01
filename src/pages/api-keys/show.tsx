import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiKeyUsage } from "@/domains/api-key/hooks/use-api-key-usage";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useShow } from "@refinedev/core";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow();
  const record = data?.data;
  const {
    usageData,
    isLoading: usageLoading,
    error: usageError,
  } = useApiKeyUsage(record?.id);

  if (isLoading) {
    return <div>{t("api_keys.messages.loading")}</div>;
  }

  if (!record) {
    return <div>{t("api_keys.messages.notFound")}</div>;
  }

  return (
    <div className="w-full h-full">
      <ShowPage record={record} canEdit={false}>
        <MetadataCard metadata={record.metadata} />
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold">
              {t("api_keys.usage.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usageLoading && usageData.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("api_keys.messages.loading")}
              </div>
            )}
            {usageError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{usageError.message}</AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("api_keys.fields.date")}</TableHead>
                  <TableHead>{t("api_keys.fields.endpoint")}</TableHead>
                  <TableHead className="text-right">
                    {t("api_keys.fields.usage")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>
                      <ShowButton
                        recordItemId={row.endpoint_name}
                        variant="link"
                        meta={{
                          workspace: record.metadata.workspace,
                        }}
                        resource="endpoints"
                      >
                        {row.endpoint_name}
                      </ShowButton>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.usage} {t("api_keys.usage.tokens")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </ShowPage>
    </div>
  );
};
