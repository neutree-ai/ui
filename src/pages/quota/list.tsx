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

const fmt = (n: number) => Number(n).toLocaleString();

export const QuotaList = () => {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const { rows, isLoading, setQuota, deleteQuota } = useQuota(workspace);

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
              <TableHead>{t("quota.fields.period")}</TableHead>
              <TableHead className="text-right">
                {t("quota.fields.limitTokens")}
              </TableHead>
              <TableHead className="text-right">
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
                  <Badge variant="outline">{t(`quota.levels.${row.level}`)}</Badge>
                </TableCell>
                <TableCell>{row.workspace}</TableCell>
                <TableCell className="font-medium">{row.targetName}</TableCell>
                <TableCell>{t(`quota.periods.${row.period}`)}</TableCell>
                <TableCell className="text-right">
                  {fmt(row.limit_tokens)}
                </TableCell>
                <TableCell className="text-right">{fmt(row.usage)}</TableCell>
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
