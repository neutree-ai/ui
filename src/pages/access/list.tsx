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
import { AccessForm } from "@/domains/access/components/AccessForm";
import { useAccess } from "@/domains/access/hooks/use-access";
import type { AccessPolicyRow } from "@/domains/access/types";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type AccessGroup = {
  key: string;
  level: AccessPolicyRow["level"];
  workspace: string;
  targetName: string;
  rules: AccessPolicyRow[];
};

export const AccessList = () => {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const { rows, isLoading, setAccess, deleteAccess } = useAccess(workspace);

  // Group flat rules by scope (level + workspace + target).
  const groups = useMemo<AccessGroup[]>(() => {
    const map = new Map<string, AccessGroup>();
    for (const row of rows) {
      const key = `${row.level}|${row.workspace}|${row.user_id ?? ""}|${row.api_key_id ?? ""}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          level: row.level,
          workspace: row.workspace,
          targetName: row.targetName,
          rules: [],
        };
        map.set(key, g);
      }
      g.rules.push(row);
    }
    return Array.from(map.values());
  }, [rows]);

  // Human-readable summary of a rule's effect.
  const ruleSummary = (row: AccessPolicyRow): string => {
    if (row.rule_type === "concurrency") {
      return t("access.summary.concurrency", { max: row.rule_spec?.max ?? "-" });
    }
    if (row.rule_type === "model_allowlist") {
      return t("access.summary.models", {
        models: (row.rule_spec?.models ?? []).join(", ") || "-",
      });
    }
    if (row.rule_type === "endpoint_allowlist") {
      return t("access.summary.endpoints", {
        endpoints:
          (row.rule_spec?.endpoints ?? [])
            .map((e) => `${e.type}:${e.name}`)
            .join(", ") || "-",
      });
    }
    return t("access.summary.rate", {
      limit: row.rule_spec?.limit ?? "-",
      window: t(`access.windows.${row.rule_spec?.window ?? "minute"}`),
    });
  };

  return (
    <ListPage
      resource="access"
      createButtonProps={{
        onClick: () => setOpen(true),
      }}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("access.set")}</DialogTitle>
            <DialogDescription>
              {t("access.messages.setDescription")}
            </DialogDescription>
          </DialogHeader>
          {workspace && (
            <AccessForm
              workspace={workspace}
              onSubmit={setAccess}
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
            {t("access.messages.empty")}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{t(`access.levels.${g.level}`)}</Badge>
              <span className="text-muted-foreground">{g.workspace}</span>
              <span className="font-medium">{g.targetName}</span>
            </div>
            {g.rules.map((row) => (
              <div key={row.id} className="flex items-center gap-3 py-1">
                <Badge variant="secondary">
                  {t(`access.ruleTypes.${row.rule_type}`)}
                </Badge>
                <span className="flex-1 text-sm">{ruleSummary(row)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("buttons.delete")}
                  onClick={() => deleteAccess(row.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ListPage>
  );
};
