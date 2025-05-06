import EngineStatus from "@/components/business/EngineStatus";
import JSONSchemaVisualizer from "@/components/business/JsonSchemaVisualizer";
import MetadataCard from "@/components/business/MetadataCard";
import { ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Engine } from "@/types";
import { useShow } from "@refinedev/core";
import { useEffect, useState } from "react";

export const EnginesShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Engine>({});
  const record = data?.data;

  const [version, setVersion] = useState(
    record?.spec.versions[0].version || ""
  );

  useEffect(() => {
    if (record) {
      setVersion(record.spec.versions[0]?.version);
    }
  }, [record]);

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>404 not found</div>;
  }

  const selectedVersion = record.spec.versions.find(
    (v) => v.version === version
  );

  return (
    <ShowPage record={record} canDelete={false} canEdit={false}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <ShowPage.Row title={"Status"}>
            <EngineStatus phase={record.status?.phase} />
          </ShowPage.Row>
          <ShowPage.Row title={"Supported Tasks"}>
            {record.spec.supported_tasks.map((task) => {
              return (
                <div
                  key={task}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-2 py-1 mr-2 text-sm font-medium text-gray-700"
                >
                  {task}
                </div>
              );
            })}
          </ShowPage.Row>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={version}
            onValueChange={(v) => {
              setVersion(v);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Engine Version" />
            </SelectTrigger>
            <SelectContent>
              {record.spec.versions.map((v) => {
                return (
                  <SelectItem value={v.version} key={v.version}>
                    {v.version}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedVersion && (
            <ShowPage.Row title={"Values Schema"}>
              <JSONSchemaVisualizer schema={selectedVersion.values_schema} />
            </ShowPage.Row>
          )}
        </CardContent>
      </Card>
    </ShowPage>
  );
};
