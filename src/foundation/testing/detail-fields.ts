import type { TFunction } from "i18next";
import type { DetailField } from "@/foundation/scene/detail-field";

/** The global `t` mock's output: the key, then any values after a colon. */
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${Object.values(values).join(",")}` : key) as TFunction;

/** The last segment of each field's label, in order. */
export const fieldKeys = (fields: { label: string }[]) =>
  fields.map((item) => item.label.split(".").pop());

/** What the value field whose label ends in `.key` gives for `record`. */
export const fieldValue = <T>(
  fields: DetailField<T>[],
  key: string,
  record: T,
) => {
  const found = fields.find((item) => item.label.endsWith(`.${key}`));
  if (typeof found?.source !== "function") throw new Error(`no value ${key}`);
  return found.source(record, t);
};
