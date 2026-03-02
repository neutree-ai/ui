import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { mergeSchemaProperties } from "../lib/merge-schema-properties";
import { getTypeColorClass } from "../lib/schema-type-color";
import { checkTypeMatch, getActualType } from "../lib/type-match";
import { SchemaTypeIcon } from "./SchemaTypeIcon";

interface ValueDisplayProps {
  value: unknown;
  type: string;
}

const ValueDisplay = ({ value, type }: ValueDisplayProps) => {
  const { t } = useTranslation();
  const actualType = getActualType(value);
  const isTypeMatch = checkTypeMatch(value, type);

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

  const { schemaProperties, extraProperties } = mergeSchemaProperties(
    schema,
    value,
  );

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
