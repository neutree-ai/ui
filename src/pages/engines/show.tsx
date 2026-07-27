import { useShow } from "@refinedev/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
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
    <ShowPage
      record={record}
      canDelete={false}
      canEdit={false}
      showCurrentBreadcrumb={false}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<EngineStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.versions")}>
              {record.spec.versions.length}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("engines.fields.supportedTasks")}>
              {record.spec.supported_tasks.length}
            </ShowPage.Meta>
          </span>
        }
      />
      <div className="mt-4 space-y-4">
        <MetadataCard metadata={record.metadata} showName={false} />
        <ShowPage.Section title={t("engines.fields.supportedTasks")}>
          <div className="flex flex-wrap gap-1.5">
            {record.spec.supported_tasks.map((task) => (
              <Badge key={task} variant="outline">
                {task}
              </Badge>
            ))}
          </div>
        </ShowPage.Section>
        <ShowPage.Section title={t("common.fields.versions")}>
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
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
