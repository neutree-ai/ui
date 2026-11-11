import type { DateRange } from "@/foundation/components/DateRangePicker";
import type { UsageScope } from "@/pages/model-usage/lib/usage-scope";

/**
 * The model usage page's view as URL query parameters, so a reload, the
 * browser history or a link from elsewhere (a Team's usage tab) opens the
 * same scope. Groups are named by metadata.name, users and applications by
 * id.
 */

const TABS = ["breakdown", "team", "apiKey", "detail"] as const;
export type UsageTab = (typeof TABS)[number];

export type UsageView = {
  /**
   * Undefined when the URL names none: the page picks its default. Null is
   * every API key the caller reads.
   */
  scope: UsageScope | null | undefined;
  tab?: UsageTab;
  range?: DateRange;
  model: string;
};

const SCOPE = "scope";
const UNIT = "department";
const TEAM = "team";
const USER = "user";
const USER_NAME = "userName";
const APP = "application";
const APP_NAME = "applicationName";
const TAB = "tab";
const FROM = "from";
const TO = "to";
const MODEL = "model";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const readScope = (params: URLSearchParams): UsageScope | null | undefined => {
  const unit = params.get(UNIT);
  const team = params.get(TEAM);
  // A Team's label is looked up by the page; its name stands in until then.
  const group = unit
    ? ({ type: "orgUnit", name: unit } as const)
    : team
      ? ({ type: "team", name: team, label: team } as const)
      : null;
  const user = params.get(USER);
  if (user) {
    return {
      type: "user",
      id: user,
      label: params.get(USER_NAME) || user,
      from: group,
    };
  }
  const app = params.get(APP);
  if (app) {
    return {
      type: "application",
      id: app,
      label: params.get(APP_NAME) || app,
      from: group,
    };
  }
  if (group) return group;
  switch (params.get(SCOPE)) {
    case "platform":
      return { type: "platform" };
    case "applications":
      return { type: "applications" };
    case "keys":
      return null;
    default:
      return undefined;
  }
};

export const readUsageView = (params: URLSearchParams): UsageView => {
  const tab = params.get(TAB);
  const from = params.get(FROM) ?? "";
  const to = params.get(TO) ?? "";
  return {
    scope: readScope(params),
    tab: TABS.find((t) => t === tab),
    range:
      DAY.test(from) && DAY.test(to) && from <= to
        ? { start: from, end: to }
        : undefined,
    model: params.get(MODEL) ?? "",
  };
};

/** `params` with the given parts of the view replaced; other keys are kept. */
export const writeUsageView = (
  params: URLSearchParams,
  change: Partial<UsageView>,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | undefined) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  if ("scope" in change) {
    for (const key of [SCOPE, UNIT, TEAM, USER, USER_NAME, APP, APP_NAME]) {
      next.delete(key);
    }
    const scope = change.scope;
    const group =
      scope?.type === "user" || scope?.type === "application"
        ? scope.from
        : scope;
    if (group?.type === "orgUnit") next.set(UNIT, group.name);
    else if (group?.type === "team") next.set(TEAM, group.name);
    if (scope === null) next.set(SCOPE, "keys");
    else if (scope?.type === "platform" || scope?.type === "applications") {
      next.set(SCOPE, scope.type);
    } else if (scope?.type === "user") {
      next.set(USER, scope.id);
      next.set(USER_NAME, scope.label);
    } else if (scope?.type === "application") {
      next.set(APP, scope.id);
      next.set(APP_NAME, scope.label);
    }
  }
  if ("tab" in change) setOrDelete(TAB, change.tab);
  if ("range" in change) {
    setOrDelete(FROM, change.range?.start);
    setOrDelete(TO, change.range?.end);
  }
  if ("model" in change) setOrDelete(MODEL, change.model);
  return next;
};
