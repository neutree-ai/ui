/**
 * Engine packages ship their `values_schema` as an arbitrary JSON schema, so the
 * console flattens it into the rows the values-schema table renders. Real
 * packages are flat (vLLM 235 parameters, SGLang 318), but imported ones may
 * declare nested objects and arrays of objects — those become child rows behind
 * an expand toggle, addressed by their dotted path.
 */

type JsonSchemaNode = {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  additionalProperties?: unknown;
};

export type ValueSchemaRow = {
  /** Dotted path, unique inside one schema (`rope_scaling.factor`). */
  id: string;
  /** Last path segment — the machine name of the field. */
  name: string;
  path: string;
  /** Human label the package declared, when it declares one. */
  title: string | null;
  /** Type branches, already split: `["string","array"]` stays two entries. */
  types: string[];
  /** Element type of an array field. */
  itemType: string | null;
  required: boolean;
  hasDefault: boolean;
  defaultValue: unknown;
  description: string;
  enumValues: unknown[] | null;
  depth: number;
  /**
   * Machine name of the enclosing field, or null for a top-level one. The
   * table stops indenting after a few levels, so past that point the label
   * uses this to stay attached to its parent.
   */
  parentName: string | null;
  parentId: string | null;
  hasChildren: boolean;
  childCount: number;
};

type ValueSchemaRows = {
  rows: ValueSchemaRow[];
  /** The schema accepts keys it does not describe (additionalProperties). */
  allowsAdditional: boolean;
};

const isNode = (value: unknown): value is JsonSchemaNode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeTypes = (type: JsonSchemaNode["type"]): string[] => {
  if (Array.isArray(type))
    return type.filter((entry) => typeof entry === "string");
  return typeof type === "string" ? [type] : [];
};

const normalizeEnum = (node: JsonSchemaNode): unknown[] | null =>
  Array.isArray(node.enum) && node.enum.length > 0 ? node.enum : null;

function buildRows(
  properties: Record<string, JsonSchemaNode>,
  requiredNames: Set<string>,
  rows: ValueSchemaRow[],
  options: {
    parentId: string | null;
    parentName: string | null;
    pathPrefix: string;
    depth: number;
  },
): void {
  for (const [name, node] of Object.entries(properties)) {
    if (!isNode(node)) continue;

    const path = options.pathPrefix ? `${options.pathPrefix}.${name}` : name;
    const itemNode = isNode(node.items) ? node.items : null;
    const childProperties = isNode(node.properties)
      ? node.properties
      : isNode(itemNode?.properties)
        ? itemNode.properties
        : null;
    const childRequired = new Set(
      isNode(node.properties)
        ? (node.required ?? [])
        : (itemNode?.required ?? []),
    );
    // Array members are addressed as `volumes[].mount_path` so the path still
    // reads as a path into the request payload.
    const childPrefix = isNode(node.properties) ? path : `${path}[]`;

    const row: ValueSchemaRow = {
      id: path,
      name,
      path,
      title:
        typeof node.title === "string" && node.title.trim() ? node.title : null,
      types: normalizeTypes(node.type),
      itemType: itemNode ? (normalizeTypes(itemNode.type)[0] ?? null) : null,
      required: requiredNames.has(name),
      hasDefault: "default" in node && node.default !== undefined,
      defaultValue: node.default,
      description:
        typeof node.description === "string" ? node.description.trim() : "",
      enumValues: normalizeEnum(node),
      depth: options.depth,
      parentName: options.parentName,
      parentId: options.parentId,
      hasChildren: Boolean(
        childProperties && Object.keys(childProperties).length > 0,
      ),
      childCount: childProperties ? Object.keys(childProperties).length : 0,
    };
    rows.push(row);

    if (childProperties) {
      buildRows(childProperties, childRequired, rows, {
        parentId: path,
        parentName: name,
        pathPrefix: childPrefix,
        depth: options.depth + 1,
      });
    }
  }
}

export function buildValueSchemaRows(schema: unknown): ValueSchemaRows {
  if (!isNode(schema) || !isNode(schema.properties)) {
    return {
      rows: [],
      allowsAdditional: isNode(schema) && schema.additionalProperties === true,
    };
  }

  const rows: ValueSchemaRow[] = [];
  buildRows(schema.properties, new Set(schema.required ?? []), rows, {
    parentId: null,
    parentName: null,
    pathPrefix: "",
    depth: 0,
  });

  return {
    rows,
    allowsAdditional: schema.additionalProperties === true,
  };
}

/**
 * The type cell labels an array with its item type (`array<integer>`) and every
 * union branch separately, so the type filter has to offer the same labels —
 * one function keeps the cell and the filter from drifting apart.
 */
export function typeBranchLabel(branch: string, row: ValueSchemaRow): string {
  return branch === "array" && row.itemType ? `array<${row.itemType}>` : branch;
}

function typeBranchLabels(row: ValueSchemaRow): string[] {
  const branches = row.types.length > 0 ? row.types : ["unknown"];
  return branches.map((branch) => typeBranchLabel(branch, row));
}

/** Every type label a filter can offer, alphabetical so the list is stable. */
export function valueSchemaTypeOptions(rows: ValueSchemaRow[]): string[] {
  const labels = new Set<string>();
  for (const row of rows) {
    for (const label of typeBranchLabels(row)) labels.add(label);
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

type ValueSchemaFilter = {
  /** Free text over the dotted path and the description. */
  query: string;
  /** One of `valueSchemaTypeOptions`, or "" for every type. */
  type: string;
  onlyRequired: boolean;
};

export function isValueSchemaFilterActive(filter: ValueSchemaFilter): boolean {
  return (
    filter.query.trim() !== "" || filter.type !== "" || filter.onlyRequired
  );
}

/**
 * The rows the table shows for a filter, or null when nothing is filtered (the
 * caller then applies its own collapsed state).
 *
 * A row has to satisfy every active part of the filter. Matching children keep
 * their ancestors, because a nested row on its own (`factor`) does not say
 * where it belongs — an ancestor is context rather than a match.
 */
export function filterValueSchemaRows(
  rows: ValueSchemaRow[],
  filter: ValueSchemaFilter,
): ValueSchemaRow[] | null {
  if (!isValueSchemaFilterActive(filter)) return null;

  const query = filter.query.trim().toLowerCase();
  const matching = rows.filter((row) => {
    if (filter.onlyRequired && !row.required) return false;
    if (filter.type && !typeBranchLabels(row).includes(filter.type)) {
      return false;
    }
    if (!query) return true;
    return (
      row.path.toLowerCase().includes(query) ||
      row.description.toLowerCase().includes(query)
    );
  });

  const keep = new Set<string>();
  for (const row of matching) {
    keep.add(row.id);
    let parentId = row.parentId;
    while (parentId) {
      keep.add(parentId);
      parentId =
        rows.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
  }
  return rows.filter((row) => keep.has(row.id));
}

/** Defaults are machine values: keep strings quoted so `""` is not blank. */
export function formatDefaultValue(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

type DescriptionSegment = { kind: "text" | "json"; value: string };

/**
 * Engine descriptions embed JSON examples in prose, e.g. SGLang's
 * `modelexpress_config`: `… Example: '{"url": "localhost:8001"}'`. The dialog
 * keeps the prose and pretty-prints the snippets it can actually parse; text
 * such as `token_id:{id}` stays untouched.
 */
export function splitDescriptionJson(
  description: string,
): DescriptionSegment[] {
  const text = description ?? "";
  const segments: DescriptionSegment[] = [];
  const pattern = /\{[^{}]*\}/g;
  let last = 0;
  let match = pattern.exec(text);

  while (match) {
    let pretty: string | null = null;
    try {
      pretty = JSON.stringify(JSON.parse(match[0]), null, 2);
    } catch {
      pretty = null;
    }

    if (pretty) {
      const quotedBefore = text[match.index - 1] === "'";
      const quotedAfter = text[match.index + match[0].length] === "'";
      const textEnd = quotedBefore ? match.index - 1 : match.index;
      if (textEnd > last) {
        // Drop the space that separated the prose from the snippet: the block
        // below it carries its own spacing.
        segments.push({
          kind: "text",
          value: text.slice(last, textEnd).replace(/\s+$/, ""),
        });
      }
      segments.push({ kind: "json", value: pretty });
      last = match.index + match[0].length + (quotedAfter ? 1 : 0);
    }

    match = pattern.exec(text);
  }

  const tail = text.slice(last);
  if (tail.trim()) segments.push({ kind: "text", value: tail });
  return segments;
}
