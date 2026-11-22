import type { TFunction } from "i18next";
import type { ReactNode } from "react";

type Source<T> =
  | ((record: T, t: TFunction) => unknown)
  | { render: (record: T) => ReactNode };
type Options = { span?: 2 | 4 };

export type DetailField<T> = { label: string; source: Source<T> } & Options;

/**
 * One field of a detail view: its label's i18n key, then a function whose
 * result `FieldValue` shows by type, or `{ render }` naming a role piece.
 */
export const field = <T>(
  label: string,
  source: Source<T>,
  options?: Options,
): DetailField<T> => ({ label, source, ...options });
