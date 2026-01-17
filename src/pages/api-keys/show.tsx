import MetadataCard from "@/components/business/MetadataCard";
import { ShowPage } from "@/components/theme";
import { ShowButton } from "@/components/theme/buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomMutation, useShow } from "@refinedev/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type ApiUsageRecord = {
  date: string;
  api_key_id: string;
  api_key_name: string;
  endpoint_name: string;
  usage: number;
};

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow();
  const record = data?.data;

  const [usageData, setUsageData] = useState<ApiUsageRecord[]>([]);

  const { mutateAsync } = useCustomMutation();

  const fetchUsageData = useCallback(async () => {
    if (!record?.id) return;

    try {
      const res = await mutateAsync({
        url: "/rpc/get_usage_by_dimension",
        method: "post",
        values: {
          p_start_date: "2025-01-01",
          p_end_date: new Date().toISOString(),
          p_api_key_id: record?.id,
        },
      });
      setUsageData(res.data as ApiUsageRecord[]);
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    }
  }, [record?.id, mutateAsync]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsageData();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchUsageData]);

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
                          workspacece: record.metadata.workspace,
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
