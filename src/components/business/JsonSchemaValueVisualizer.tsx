import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import {
  AlertCircle,
  Box,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Hash,
  List,
  Type,
  XSquare,
} from "lucide-react";
import { useState } from "react";

interface SchemaTypeIconProps {
  type: string;
}

const SchemaTypeIcon = ({ type }: SchemaTypeIconProps) => {
  switch (type) {
    case "object":
      return <Box className="h-4 w-4" />;
    case "array":
      return <List className="h-4 w-4" />;
    case "string":
      return <Type className="h-4 w-4" />;
    case "integer":
    case "number":
      return <Hash className="h-4 w-4" />;
    case "boolean":
      return (
        <div className="flex">
          <CheckSquare className="h-4 w-4" />
          <XSquare className="h-4 w-4 -ml-1" />
        </div>
      );
    default:
      return <Type className="h-4 w-4" />;
  }
};

const getTypeColorClass = (type: string) => {
  switch (type) {
    case "object":
      return "text-blue-500 dark:text-blue-400";
    case "array":
      return "text-purple-500 dark:text-purple-400";
    case "string":
      return "text-green-500 dark:text-green-400";
    case "integer":
    case "number":
      return "text-amber-500 dark:text-amber-400";
    case "boolean":
      return "";
    default:
      return "text-muted-foreground";
  }
};

const inferSchemaFromValue = (value: unknown): Record<string, unknown> => {
  if (value === null) {
    return { type: "null" };
  }

  if (Array.isArray(value)) {
    const itemType =
      value.length > 0 ? inferSchemaFromValue(value[0]) : { type: "string" };
    return {
      type: "array",
      items: itemType,
    };
  }

  const actualType = typeof value;

  switch (actualType) {
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>)) {
        properties[key] = inferSchemaFromValue(
          (value as Record<string, unknown>)[key],
        );
      }
      return {
        type: "object",
        properties,
      };
    }
    case "string":
      return { type: "string" };
    case "number":
      return {
        type: Number.isInteger(value as number) ? "integer" : "number",
      };
    case "boolean":
      return { type: "boolean" };
    default:
      return { type: "string" };
  }
};

interface ValueDisplayProps {
  value: unknown;
  type: string;
}

const ValueDisplay = ({ value, type }: ValueDisplayProps) => {
  const { t } = useTranslation();
  const getActualType = (val: unknown) => {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    return typeof val;
  };

  const actualType = getActualType(value);
  const isTypeMatch =
    actualType === type ||
    (type === "integer" &&
      actualType === "number" &&
      Number.isInteger(value)) ||
    (type === "number" && actualType === "number");

  const formatValue = () => {
    if (value === undefined)
      return (
        <span className="italic text-muted-foreground">
          {t("components.jsonSchemaValueVisualizer.undefined")}
        </span>
      );
    if (value === null)
      return (
        <span className="italic text-muted-foreground">
          {t("components.jsonSchemaValueVisualizer.null")}
        </span>
      );

    switch (actualType) {
      case "string":
        return (
          <span className="text-green-600 dark:text-green-400">
            "{String(value)}"
          </span>
        );
      case "number":
        return (
          <span className="text-amber-600 dark:text-amber-400">
            {String(value)}
          </span>
        );
      case "boolean":
        return (
          <span className="text-teal-600 dark:text-teal-400">
            {String(value)}
          </span>
        );
      case "object":
      case "array":
        return (
          <span className="italic text-muted-foreground">{actualType}</span>
        );
      default:
        return <span className="text-foreground">{String(value)}</span>;
    }
  };

  return (
    <div className="flex items-center">
      {!isTypeMatch && (
        <Tooltip>
          <TooltipTrigger>
            <AlertCircle className="h-4 w-4 text-destructive mr-1" />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {t(
                "components.jsonSchemaValueVisualizer.typeMismatch",
                "type miss match: expect {{expectedType}}, actual {{actualType}}",
                {
                  expectedType: type,
                  actualType: actualType,
                },
              )}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
      <div className="font-mono">{formatValue()}</div>
    </div>
  );
};

interface PropertyNodeProps {
  name: string;
  schema: Record<string, unknown>;
  value: unknown;
  path?: string;
  required?: boolean;
  depth?: number;
  hideEmptyValues?: boolean;
}

const PropertyNode = ({
  name,
  schema,
  value,
  path = "",
  depth = 0,
  hideEmptyValues = true,
}: PropertyNodeProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(depth < 2);

  const getAllProperties = () => {
    const schemaProperties =
      (schema?.properties as Record<string, unknown>) || {};
    const extraProperties: Record<string, Record<string, unknown>> = {};

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const valueObj = value as Record<string, unknown>;
      for (const key of Object.keys(valueObj)) {
        if (!schemaProperties[key]) {
          extraProperties[key] = inferSchemaFromValue(valueObj[key]);
        }
      }
    }

    return { schemaProperties, extraProperties };
  };

  const { schemaProperties, extraProperties } = getAllProperties();

  const hasChildren = Boolean(
    (String(schema.type) === "object" &&
      ((schema.properties &&
        Object.keys(schema.properties as object).length > 0) ||
        (value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.keys(value).length > 0))) ||
      (String(schema.type) === "array" && schema.items && Array.isArray(value)),
  );

  const hasValue = value !== undefined;

  // Hide this property if hideEmptyValues is true and there's no value
  if (hideEmptyValues && !hasValue) {
    return null;
  }

  const indentStyle = {
    paddingLeft: `${depth * 20}px`,
  };

  const rowStyle = "flex items-center py-1 hover:bg-accent/50 rounded";

  const schemaType = String(schema.type || "unknown");
  const schemaFormat = schema.format ? String(schema.format) : undefined;

  return (
    <div className="w-full">
      <div className={rowStyle} style={indentStyle}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="mr-1 focus:outline-none"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4 mr-1" />
        )}

        <div className={getTypeColorClass(schemaType)}>
          <SchemaTypeIcon type={schemaType} />
        </div>

        <span className="ml-2 font-medium text-foreground">{name}</span>

        <Badge variant="secondary" className={"ml-2 text-xs"}>
          {schemaType}
          {schemaFormat ? `:${schemaFormat}` : ""}
        </Badge>

        <div className="ml-4">
          {hasValue ? (
            <ValueDisplay value={value} type={schemaType} />
          ) : (
            <span className="text-muted-foreground italic text-sm">
              {t("components.jsonSchemaValueVisualizer.noValue")}
            </span>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className="mt-1">
          {schemaType === "object" &&
            Object.entries(schemaProperties).map(([childName, childSchema]) => (
              <PropertyNode
                key={`${path}.${childName}`}
                name={childName}
                schema={childSchema as Record<string, unknown>}
                value={(value as Record<string, unknown>)?.[childName]}
                path={`${path}.${childName}`}
                depth={depth + 1}
                hideEmptyValues={hideEmptyValues}
              />
            ))}

          {schemaType === "object" &&
            Object.entries(extraProperties).map(
              ([childName, inferredSchema]) => (
                <PropertyNode
                  key={`${path}.${childName}_extra`}
                  name={childName}
                  schema={inferredSchema}
                  value={(value as Record<string, unknown>)?.[childName]}
                  path={`${path}.${childName}`}
                  depth={depth + 1}
                  hideEmptyValues={hideEmptyValues}
                />
              ),
            )}

          {schemaType === "array" &&
            Boolean(schema.items) &&
            Array.isArray(value) &&
            value.map((item, index) => (
              <PropertyNode
                key={`${path}[${index}]`}
                name={`[${index}]`}
                schema={schema.items as Record<string, unknown>}
                value={item}
                path={`${path}[${index}]`}
                depth={depth + 1}
                hideEmptyValues={hideEmptyValues}
              />
            ))}
        </div>
      )}
    </div>
  );
};

interface JSONSchemaValueVisualizerProps {
  schema: Record<string, unknown>;
  value: unknown;
  hideEmptyValues?: boolean;
}

const JSONSchemaValueVisualizer = ({
  schema,
  value,
  hideEmptyValues = true,
}: JSONSchemaValueVisualizerProps) => {
  const { t } = useTranslation();

  return (
    <div className="w-full bg-background text-foreground">
      <PropertyNode
        name={
          schema.title
            ? String(schema.title)
            : t("components.jsonSchemaValueVisualizer.root")
        }
        schema={schema}
        value={value}
        hideEmptyValues={hideEmptyValues}
      />
    </div>
  );
};

export default JSONSchemaValueVisualizer;
