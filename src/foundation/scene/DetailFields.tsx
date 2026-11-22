import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import type { DetailField } from "@/foundation/scene/detail-field";
import { ShowPage } from "@/foundation/scene/ShowPage";
import { FieldValue } from "@/foundation/type/FieldValue";

const SPAN_CLASS = { 2: "lg:col-span-2", 4: "lg:col-span-4" };

/** A record's fields as a grid of `ShowPage.Row`, or `ShowPage.Meta` items when `inline`. */
export function DetailFields<T>({
  fields,
  record,
  inline,
  className,
}: {
  fields: DetailField<T>[];
  record: T;
  inline?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const content = ({ source }: DetailField<T>) =>
    typeof source === "function" ? (
      <FieldValue value={source(record, t)} />
    ) : (
      (source.render(record) ?? null)
    );

  if (inline)
    return fields.map((item) => (
      <ShowPage.Meta key={item.label} label={t(item.label)}>
        {content(item)}
      </ShowPage.Meta>
    ));

  return (
    <div className={cn("grid grid-cols-1 gap-5 lg:grid-cols-4", className)}>
      {fields.map((item) => (
        <div
          key={item.label}
          className={item.span ? SPAN_CLASS[item.span] : undefined}
        >
          <ShowPage.Row title={t(item.label)}>{content(item)}</ShowPage.Row>
        </div>
      ))}
    </div>
  );
}
