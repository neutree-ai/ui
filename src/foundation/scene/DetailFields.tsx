import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { ShowPage } from "@/foundation/scene/ShowPage";
import { FieldValue } from "@/foundation/type/FieldValue";

/**
 * One field of a detail view. `value` is shown by its type (`FieldValue`);
 * `render` hands the field to a role piece (time, status, unit) instead.
 */
export type DetailField<T> = {
  key: string;
  /** i18n key of the label. */
  label: string;
  /** Grid columns the field takes, out of four. */
  span?: 2 | 4;
} & (
  | { value: (record: T, t: TFunction) => unknown }
  | { render: (record: T) => ReactNode }
);

const SPAN_CLASS = { 2: "lg:col-span-2", 4: "lg:col-span-4" };

/**
 * A record's fields in the detail layout: a grid of `ShowPage.Row`, or
 * `ShowPage.Meta` items for the header line (`inline`).
 */
export function DetailFields<T>({
  fields,
  record,
  inline = false,
  className,
}: {
  fields: DetailField<T>[];
  record: T;
  inline?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const content = (field: DetailField<T>) =>
    "render" in field ? (
      (field.render(record) ?? null)
    ) : (
      <FieldValue value={field.value(record, t)} />
    );

  if (inline) {
    return fields.map((field) => (
      <ShowPage.Meta key={field.key} label={t(field.label)}>
        {content(field)}
      </ShowPage.Meta>
    ));
  }

  return (
    <div className={cn("grid grid-cols-1 gap-5 lg:grid-cols-4", className)}>
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.span ? SPAN_CLASS[field.span] : undefined}
        >
          <ShowPage.Row title={t(field.label)}>{content(field)}</ShowPage.Row>
        </div>
      ))}
    </div>
  );
}
