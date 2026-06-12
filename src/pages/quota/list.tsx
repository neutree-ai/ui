import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuotaForm } from "@/domains/quota/components/QuotaForm";
import { useQuota } from "@/domains/quota/hooks/use-quota";
import type { QuotaPolicyRow } from "@/domains/quota/types";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString();

// Progress bar of used / limit, colored amber >=80% and red when over quota.
const UsageBar = ({ used, limit }: { used: number; limit: number }) => {
  const ratio = limit > 0 ? used / limit : 0;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const over = limit > 0 && used >= limit;
  const warn = !over && ratio >= 0.8;
  return (
    <div className="min-w-[160px]">
      <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
        <div
          className={cn(
            "h-full transition-all",
            over ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {fmt(used)} / {fmt(limit)}
        {limit > 0 ? ` (${Math.round(ratio * 100)}%)` : ""}
      </div>
    </div>
  );
};

export const QuotaList = () => {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const { rows, isLoading, setQuota, deleteQuota } = useQuota(workspace);

  const dimensionLabel = (row: QuotaPolicyRow) =>
    row.dimension_type
      ? `${t(`quota.dimensions.${row.dimension_type}`)}: ${row.dimension_value}`
      : "—";

  const remainingBadge = (row: QuotaPolicyRow) => {
    if (row.remaining <= 0) {
      return <Badge variant="destructive">{fmt(row.remaining)}</Badge>;
    }
    if (row.remaining < row.limit_tokens * 0.2) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-500">
          {fmt(row.remaining)}
        </Badge>
      );
    }
    return <span>{fmt(row.remaining)}</span>;
  };

  return (
    <ListPage
      resource="quota"
      createButtonProps={{
        onClick: () => setOpen(true),
      }}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("quota.set")}</DialogTitle>
            <DialogDescription>
              {t("quota.messages.setDescription")}
            </DialogDescription>
          </DialogHeader>
          {workspace && (
            <QuotaForm
              workspace={workspace}
              onSubmit={setQuota}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="pt-2 sm:pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("quota.fields.level")}</TableHead>
              <TableHead>{t("common.fields.workspace")}</TableHead>
              <TableHead>{t("quota.fields.target")}</TableHead>
              <TableHead>{t("quota.fields.dimension")}</TableHead>
              <TableHead>{t("quota.fields.period")}</TableHead>
              <TableHead className="min-w-[160px]">
                {t("quota.fields.currentUsage")}
              </TableHead>
              <TableHead className="text-right">
                {t("quota.fields.remaining")}
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader className="mx-auto w-6 text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("quota.messages.empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Badge variant="outline">
                    {t(`quota.levels.${row.level}`)}
                  </Badge>
                </TableCell>
                <TableCell>{row.workspace}</TableCell>
                <TableCell className="font-medium">{row.targetName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {dimensionLabel(row)}
                </TableCell>
                <TableCell>{t(`quota.periods.${row.period}`)}</TableCell>
                <TableCell>
                  <UsageBar used={row.usage} limit={row.limit_tokens} />
                </TableCell>
                <TableCell className="text-right">
                  {remainingBadge(row)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t("buttons.delete")}
                    onClick={() => deleteQuota(row.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ListPage>
  );
};
