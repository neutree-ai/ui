import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import type { ClusterComponentStatusMap } from "@/domains/cluster/types";

type ClusterComponentStatusListProps = {
  componentStatus: ClusterComponentStatusMap | null | undefined;
  t: (key: string, options?: { defaultValue?: string }) => string;
};

const formatManaged = (
  managed: boolean | null | undefined,
  t: ClusterComponentStatusListProps["t"],
) => {
  if (managed == null) return "-";

  return managed ? t("common.options.enabled") : t("common.options.disabled");
};

const formatComponentName = (
  componentName: string,
  t: ClusterComponentStatusListProps["t"],
) => {
  if (componentName === "accelerator_virtualization") {
    return t("clusters.componentNames.acceleratorVirtualization", {
      defaultValue: "Accelerator Virtualization",
    });
  }

  return componentName;
};

export const ClusterComponentStatusList = ({
  componentStatus,
  t,
}: ClusterComponentStatusListProps) => {
  const rows = Object.entries(componentStatus ?? {})
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
      Boolean(entry[1]),
    )
    .sort(([componentA], [componentB]) => componentA.localeCompare(componentB));

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 text-sm font-medium">
        {t("clusters.sections.componentStatus")}
      </div>
      <UITable>
        <TableHeader>
          <TableRow>
            <TableHead>{t("clusters.fields.componentName")}</TableHead>
            <TableHead>{t("common.fields.status")}</TableHead>
            <TableHead>{t("common.fields.version")}</TableHead>
            <TableHead>{t("clusters.fields.managed")}</TableHead>
            <TableHead>{t("common.fields.reason")}</TableHead>
            <TableHead>{t("common.fields.message")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([componentName, status]) => (
            <TableRow key={componentName}>
              <TableCell className="font-medium">
                {formatComponentName(componentName, t)}
              </TableCell>
              <TableCell>{status.phase ?? "-"}</TableCell>
              <TableCell>{status.version ?? "-"}</TableCell>
              <TableCell>{formatManaged(status.managed, t)}</TableCell>
              <TableCell>{status.reason ?? "-"}</TableCell>
              <TableCell className="max-w-[320px] whitespace-normal break-words">
                {status.message ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  );
};
