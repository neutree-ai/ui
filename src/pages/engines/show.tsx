import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EngineStatus from "@/domains/engine/components/EngineStatus";
import JSONSchemaVisualizer from "@/domains/engine/components/JsonSchemaVisualizer";
import type { Engine } from "@/domains/engine/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useShow } from "@refinedev/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

export const EnginesShow = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const versionFromQuery = searchParams.get("version");
  const {
    query: { data, isLoading },
  } = useShow<Engine>({});
  const record = data?.data;

  const [version, setVersion] = useState(
    record?.spec.versions[0].version || "",
  );

  useEffect(() => {
    if (record) {
      // Use version from URL query param if valid, otherwise fall back to first version
      const validVersion = record.spec.versions.find(
        (v) => v.version === versionFromQuery,
      );
      setVersion(validVersion?.version || record.spec.versions[0]?.version);
    }
  }, [record, versionFromQuery]);

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const selectedVersion = record.spec.versions.find(
    (v) => v.version === version,
  );

  return (
    <ShowPage record={record} canDelete={false} canEdit={false}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <ShowPage.Row title={t("common.fields.status")}>
            <EngineStatus {...record.status} />
          </ShowPage.Row>
          <ShowPage.Row title={t("engines.fields.supportedTasks")}>
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
          <CardTitle>{t("common.fields.versions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={version}
            onValueChange={(v) => {
              setVersion(v);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("engines.fields.engineVersion")} />
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
            <ShowPage.Row title={t("engines.fields.valuesSchema")}>
              <JSONSchemaVisualizer schema={selectedVersion.values_schema} />
            </ShowPage.Row>
          )}
        </CardContent>
      </Card>
    </ShowPage>
  );
};
