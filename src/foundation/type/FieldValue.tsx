import { useTranslation } from "@/foundation/lib/i18n";
import { EmptyValue } from "@/foundation/type/EmptyValue";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEmpty = (value: unknown) =>
  value == null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0);

const asText = (value: unknown) =>
  typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : String(value);

/**
 * One value of a resource, shown by its runtime type. A field whose meaning
 * needs more than its type (a time, a status, a unit) is rendered by a role
 * piece instead.
 */
export function FieldValue({ value }: { value: unknown }) {
  const { t, i18n } = useTranslation();

  if (isEmpty(value)) return <EmptyValue />;
  if (typeof value === "boolean")
    return <>{t(value ? "common.values.yes" : "common.values.no")}</>;
  if (typeof value === "number")
    return <>{value.toLocaleString(i18n.resolvedLanguage)}</>;
  if (Array.isArray(value))
    return (
      <span className="[overflow-wrap:anywhere]">
        {value.map(asText).join(", ")}
      </span>
    );
  if (isPlainObject(value))
    return (
      <span className="flex flex-wrap gap-2">
        {Object.entries(value).map(([key, entry]) => (
          <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {key}={asText(entry)}
          </code>
        ))}
      </span>
    );
  return <span className="[overflow-wrap:anywhere]">{String(value)}</span>;
}
