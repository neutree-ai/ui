import { useCustomMutation, useShow } from "@refinedev/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowPage } from "@/components/theme";
import { useEffect, useState } from "react";
import MetadataCard from "@/components/business/MetadataCard";

export const ApiKeysShow = () => {
  const {
    query: { data, isLoading },
  } = useShow();
  const record = data?.data;

  const [usageData, setUsageData] = useState<any[]>([]);

  const { mutateAsync } = useCustomMutation();
  useEffect(() => {
    mutateAsync({
      url: `/rpc/get_usage_by_dimension`,
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
    return <div>Loading...</div>;
  }

  if (!record) {
    return <div>404 not found</div>;
  }

  return (
    <div className="w-full h-full">
      <ShowPage record={record} canEdit={false}>
        <MetadataCard metadata={record.metadata} />
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold">
              API Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>API Key Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
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
                      {row.usage} tokens
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
