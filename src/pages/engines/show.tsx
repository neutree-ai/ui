import { useShow } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import EngineStatus from "@/domains/engine/components/EngineStatus";
import JSONSchemaVisualizer from "@/domains/engine/components/JsonSchemaVisualizer";
import { isExceptionalEnginePhase } from "@/domains/engine/lib/engine-phase";
import { sortEngineVersionsNewestFirst } from "@/domains/engine/lib/version-order";
import type { Engine } from "@/domains/engine/types";
import { Link } from "@/foundation/components/Link";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";
import { cn } from "@/foundation/lib/utils";

export const EnginesShow = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const versionFromQuery = searchParams.get("version");
  const {
    query: { data, isLoading },
  } = useShow<Engine>({});
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const versions = record.spec.versions ?? [];
  // Engines return versions in creation order, so the default comes from the
  // comparison, not from `spec.versions[0]` — which used to select the oldest.
  const newestFirst = sortEngineVersionsNewestFirst(versions);
  const selected =
    versions.find((version) => version.version === versionFromQuery) ??
    newestFirst[0];
  const showVersionList = newestFirst.length > 1;
  const workspace = record.metadata.workspace ?? "";
  const versionHref = (version: string) =>
    `/${workspace}/engines/show/${record.metadata.name}?version=${encodeURIComponent(version)}`;

  return (
    <ShowPage
      record={record}
      canDelete={false}
      canEdit={false}
      showCurrentBreadcrumb={false}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={
          isExceptionalEnginePhase(record.status?.phase) ? (
            <EngineStatus {...record.status} />
          ) : undefined
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.versions")}>
              {versions.length}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("engines.fields.supportedTasks")}>
              {record.spec.supported_tasks?.length ?? 0}
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("engines.fields.supportedTasks")}>
          <div className="flex flex-wrap gap-1.5">
            {(record.spec.supported_tasks ?? []).map((task) => (
              <Badge key={task} variant="outline">
                {task}
              </Badge>
            ))}
          </div>
        </ShowPage.Section>
        <ShowPage.Section
          title={t("common.fields.versions")}
          // A single version has no list to scan; name it instead of leaving
          // the schema unattributed.
          description={
            !showVersionList && selected ? (
              <code className="font-mono">{selected.version}</code>
            ) : undefined
          }
        >
          <div
            className={
              showVersionList
                ? "grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]"
                : undefined
            }
          >
            {showVersionList && (
              <nav
                aria-label={t("engines.versions.all")}
                className="flex flex-wrap content-start gap-1 md:max-h-[420px] md:flex-col md:flex-nowrap md:overflow-auto md:pr-1"
              >
                {newestFirst.map((item, index) => (
                  <Link
                    key={item.version}
                    href={versionHref(item.version)}
                    aria-current={
                      item.version === selected?.version ? "true" : undefined
                    }
                    className={cn(
                      "flex flex-wrap items-start gap-2 rounded-[var(--nt-radius-input)] border border-transparent px-2 py-1.5 transition-colors hover:bg-muted/60",
                      item.version === selected?.version &&
                        "border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-light)]",
                    )}
                  >
                    <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5 text-[var(--nt-text-neutral-primary)]">
                      {item.version}
                    </code>
                    {index === 0 && (
                      <Badge
                        variant="default"
                        className="mt-0.5 px-1.5 py-0 text-[10px] leading-4"
                      >
                        {t("engines.versions.latest")}
                      </Badge>
                    )}
                  </Link>
                ))}
              </nav>
            )}
            {selected && (
              <ShowPage.Row title={t("engines.fields.valuesSchema")}>
                <JSONSchemaVisualizer schema={selected.values_schema} />
              </ShowPage.Row>
            )}
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
