import MetadataCard from "@/components/business/MetadataCard";
import { ShowPage } from "@/components/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomMutation, useShow } from "@refinedev/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow();
  const record = data?.data;

  const [usageData, setUsageData] = useState<any[]>([]);

  const { mutateAsync } = useCustomMutation();
  useEffect(() => {
    mutateAsync({
      url: "/rpc/get_usage_by_dimension",
      method: "post",
      values: {
        p_start_date: "2025-01-01",
        p_end_date: new Date().toISOString(),
        p_api_key_id: record?.id,
      },
    }).then((res) => {
      setUsageData(res.data as any[]);
    });
  }, [record, mutateAsync]);

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("api_keys.fields.date")}</TableHead>
                  <TableHead>{t("api_keys.fields.name")}</TableHead>
                  <TableHead>{t("api_keys.fields.model")}</TableHead>
                  <TableHead>{t("api_keys.fields.workspace")}</TableHead>
                  <TableHead className="text-right">
                    {t("api_keys.fields.usage")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.api_key_name}</TableCell>
                    <TableCell>{row.model}</TableCell>
                    <TableCell>{row.workspace}</TableCell>
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
