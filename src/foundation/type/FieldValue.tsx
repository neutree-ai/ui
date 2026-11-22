import { useTranslation } from "@/foundation/lib/i18n";
import { EmptyValue } from "@/foundation/type/EmptyValue";

const isEmpty = (value: unknown) =>
  value == null ||
  value === "" ||
  (typeof value === "object" && Object.keys(value).length === 0);

const asText = (value: unknown) =>
  typeof value === "object" ? JSON.stringify(value) : String(value);

/**
 * One value of a resource, shown by its runtime type. A field whose meaning
 * needs more than its type (a time, a status, a unit) is rendered by a role
 * piece instead.
 */
export function FieldValue({ value }: { value: unknown }) {
  const { t, i18n } = useTranslation();

  if (isEmpty(value)) return <EmptyValue />;
  if (typeof value === "boolean")
    return t(value ? "common.values.yes" : "common.values.no");
  if (typeof value === "number")
    return value.toLocaleString(i18n.resolvedLanguage);
  if (typeof value === "object" && !Array.isArray(value))
    return (
      <span className="flex flex-wrap gap-2">
        {Object.entries(value as object).map(([key, entry]) => (
          <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {key}={asText(entry)}
          </code>
        ))}
      </span>
    );
  return (
    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {Array.isArray(value) ? value.map(asText).join(", ") : String(value)}
    </span>
  );
}
