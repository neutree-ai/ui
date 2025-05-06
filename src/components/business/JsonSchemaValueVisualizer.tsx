import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Box,
  List,
  Type,
  Hash,
  CheckSquare,
  XSquare,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Get type-specific icon color classes
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
      return ""; // Special case handled in component
    default:
      return "text-muted-foreground";
  }
};

interface ValueDisplayProps {
  value: any;
  type: string;
}

const ValueDisplay = ({ value, type }: ValueDisplayProps) => {
  const getActualType = (val: any) => {
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
      return <span className="italic text-muted-foreground">undefined</span>;
    if (value === null)
      return <span className="italic text-muted-foreground">null</span>;

    switch (actualType) {
      case "string":
        return (
          <span className="text-green-600 dark:text-green-400">"{value}"</span>
        );
      case "number":
        return (
          <span className="text-amber-600 dark:text-amber-400">{value}</span>
        );
      case "boolean":
        return (
          <span className="text-teal-600 dark:text-teal-400">
            {value.toString()}
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
              type miss match: expect {type}, actual {actualType}
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
  schema: any;
  value: any;
  path?: string;
  required?: boolean;
  depth?: number;
}

const PropertyNode = ({
  name,
  schema,
  value,
  path = "",
  depth = 0,
}: PropertyNodeProps) => {
  const [isOpen, setIsOpen] = useState(depth < 2);

  const hasChildren =
    (schema.type === "object" &&
      schema.properties &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)) ||
    (schema.type === "array" && schema.items && Array.isArray(value));

  const hasValue = value !== undefined;

  const indentStyle = {
    paddingLeft: `${depth * 20}px`,
  };

  const rowStyle = "flex items-center py-1 hover:bg-accent/50 rounded";

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

        <div className={getTypeColorClass(schema.type)}>
          <SchemaTypeIcon type={schema.type} />
        </div>

        <span className="ml-2 font-medium text-foreground">{name}</span>

        <Badge variant="outline" className="ml-2 text-xs">
          {schema.type}
          {schema.format ? `:${schema.format}` : ""}
        </Badge>

        <div className="ml-4">
          {hasValue ? (
            <ValueDisplay value={value} type={schema.type} />
          ) : (
            <span className="text-muted-foreground italic text-sm">
              no value
            </span>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className="mt-1">
          {schema.type === "object" &&
            schema.properties &&
            Object.entries(schema.properties).map(
              ([childName, childSchema]) => (
                <PropertyNode
                  key={`${path}.${childName}`}
                  name={childName}
                  schema={childSchema}
                  value={value?.[childName]}
                  path={`${path}.${childName}`}
                  depth={depth + 1}
                />
              ),
            )}

          {schema.type === "array" &&
            schema.items &&
            Array.isArray(value) &&
            value.map((item, index) => (
              <PropertyNode
                key={`${path}[${index}]`}
                name={`[${index}]`}
                schema={schema.items}
                value={item}
                path={`${path}[${index}]`}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
};

interface JSONSchemaValueVisualizerProps {
  schema: any;
  value: any;
}

const JSONSchemaValueVisualizer = ({
  schema,
  value,
}: JSONSchemaValueVisualizerProps) => {
  return (
    <div className="w-full bg-background text-foreground">
      <PropertyNode
        name={schema.title || "Root"}
        schema={schema}
        value={value}
      />
    </div>
  );
};

export default JSONSchemaValueVisualizer;
