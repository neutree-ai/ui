import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { createdKeySummary } from "@/domains/api-key/lib/created-key-summary";
import { EmptyValue } from "@/foundation/type/EmptyValue";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The created key's Project, name and description, clipped to a few lines. */
export function CreatedKeySummary({
  summary,
}: {
  summary: ReturnType<typeof createdKeySummary>;
}) {
  const { t } = useTranslation();
  const { project, name, description } = summary;
  return (
    <dl className="space-y-2 rounded-md border p-3" data-testid="key-summary">
      {project && (
        <Row label={t("api_keys.fields.project")}>
          <span className="line-clamp-2 break-all" title={project.name ?? ""}>
            {project.unresolved ? (
              <EmptyValue />
            ) : (
              (project.name ?? t("api_keys.projects.ungrouped"))
            )}
          </span>
        </Row>
      )}
      <Row label={t("api_keys.fields.displayName")}>
        <span className="line-clamp-2 break-all" title={name}>
          {name || <EmptyValue />}
        </span>
      </Row>
      <Row label={t("api_keys.fields.description")}>
        {description ? (
          <span
            className="line-clamp-3 whitespace-pre-wrap break-all"
            title={description}
          >
            {description}
          </span>
        ) : (
          <EmptyValue />
        )}
      </Row>
    </dl>
  );
}
