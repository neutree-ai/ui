import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <div className="min-w-[180px] flex-1">
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

type QuotaGroup = {
  key: string;
  level: QuotaPolicyRow["level"];
  workspace: string;
  targetName: string;
  period: QuotaPolicyRow["period"];
  base?: QuotaPolicyRow;
  subs: QuotaPolicyRow[];
};

export const QuotaList = () => {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const { rows, isLoading, setQuotaMany, deleteQuota } = useQuota(workspace);

  // Group flat policy rows by scope (level + workspace + target + period); a
  // group has an optional base (dimension-agnostic) quota plus dimension
  // sub-quotas.
  const groups = useMemo<QuotaGroup[]>(() => {
    const map = new Map<string, QuotaGroup>();
    for (const row of rows) {
      const key = `${row.level}|${row.workspace}|${row.user_id ?? ""}|${row.api_key_id ?? ""}|${row.period}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          level: row.level,
          workspace: row.workspace,
          targetName: row.targetName,
          period: row.period,
          subs: [],
        };
        map.set(key, g);
      }
      if (row.dimension_type) g.subs.push(row);
      else g.base = row;
    }
    return Array.from(map.values());
  }, [rows]);

  const quotaRow = (label: React.ReactNode, row: QuotaPolicyRow) => (
    <div key={row.id} className="flex items-center gap-3 py-1">
      <div className="w-44 shrink-0 text-sm">{label}</div>
      <UsageBar used={row.usage} limit={row.limit_tokens} />
      <Button
        variant="ghost"
        size="icon"
        title={t("buttons.delete")}
        onClick={() => deleteQuota(row.id)}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );

  return (
    <ListPage
      resource="quota"
      createButtonProps={{
        onClick: () => setOpen(true),
      }}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("quota.set")}</DialogTitle>
            <DialogDescription>
              {t("quota.messages.setDescription")}
            </DialogDescription>
          </DialogHeader>
          {workspace && (
            <QuotaForm
              workspace={workspace}
              onSubmit={setQuotaMany}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-3 pt-2 sm:pt-4">
        {isLoading && groups.length === 0 && (
          <div className="flex h-24 items-center justify-center">
            <Loader className="w-6 text-muted-foreground" />
          </div>
        )}
        {!isLoading && groups.length === 0 && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            {t("quota.messages.empty")}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{t(`quota.levels.${g.level}`)}</Badge>
              <span className="text-muted-foreground">{g.workspace}</span>
              <span className="font-medium">{g.targetName}</span>
              <Badge variant="secondary">
                {t(`quota.periods.${g.period}`)}
              </Badge>
            </div>
            {g.base && quotaRow(t("quota.fields.overall"), g.base)}
            {g.subs.map((s) =>
              quotaRow(
                <span>
                  <span className="text-muted-foreground">
                    {t(`quota.dimensions.${s.dimension_type}`)}:
                  </span>{" "}
                  {s.dimension_value}
                </span>,
                s,
              ),
            )}
          </div>
        ))}
      </div>
    </ListPage>
  );
};
