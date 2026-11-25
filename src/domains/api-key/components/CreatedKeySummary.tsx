import type { CreatedKeySummary as Summary } from "@/domains/api-key/lib/created-key-summary";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { type DetailField, field } from "@/foundation/scene/detail-field";
import { EmptyValue } from "@/foundation/type/EmptyValue";

const projectField = field<Summary>("api_keys.fields.project", (s, t) =>
  s.project?.kind === "ungrouped"
    ? t("api_keys.projects.ungrouped")
    : s.project?.kind === "named"
      ? s.project.name
      : null,
);

const fields: DetailField<Summary>[] = [
  field("api_keys.fields.displayName", (s) => s.name),
  field(
    "api_keys.fields.description",
    {
      render: (s) =>
        s.description ? (
          <span
            className="line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere]"
            title={s.description}
          >
            {s.description}
          </span>
        ) : (
          <EmptyValue />
        ),
    },
    { span: 2 },
  ),
];

/** The created key's Project, name and description; a long description is clipped. */
export function CreatedKeySummary({ summary }: { summary: Summary }) {
  return (
    <div data-testid="key-summary">
      <DetailFields
        record={summary}
        fields={summary.project ? [projectField, ...fields] : fields}
        className="gap-3 rounded-md border p-3 lg:grid-cols-2"
      />
    </div>
  );
}
