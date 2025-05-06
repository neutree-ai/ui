import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Box,
  List,
  Hash,
  CheckSquare,
  XSquare,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Type-safe icons mapping
const SchemaTypeIcon = ({ type }: { type: string }) => {
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
          <XSquare className="h-4 w-4 ml-1" />
        </div>
      );
    default:
      return <File className="h-4 w-4" />;
  }
};

interface PropertyNodeProps {
  name: string;
  schema: any;
  required?: boolean;
  depth?: number;
}

const PropertyNode = ({
  name,
  schema,
  required = false,
  depth = 0,
}: PropertyNodeProps) => {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren =
    (schema.type === "object" && schema.properties) ||
    (schema.type === "array" && schema.items);

  const indentStyle = {
    paddingLeft: `${depth * 20}px`,
  };

  const rowStyle = "flex items-center py-1 hover:bg-accent/50 rounded";

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
        return ""; // Special case handled in the component
      default:
        return "text-muted-foreground";
    }
  };

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

        {required && (
          <Badge variant="destructive" className="ml-2 text-xs">
            required
          </Badge>
        )}

        {schema.description && (
          <span className="ml-2 text-muted-foreground text-sm truncate max-w-md">
            {schema.description}
          </span>
        )}
      </div>

      {isOpen && hasChildren && (
        <div className="mt-1">
          {schema.type === "object" &&
            schema.properties &&
            Object.entries(schema.properties).map(
              ([childName, childSchema]) => (
                <PropertyNode
                  key={childName}
                  name={childName}
                  schema={childSchema}
                  required={schema.required?.includes(childName)}
                  depth={depth + 1}
                />
              ),
            )}

          {schema.type === "array" && schema.items && (
            <PropertyNode
              name="items"
              schema={schema.items}
              depth={depth + 1}
            />
          )}
        </div>
      )}
    </div>
  );
};

interface JSONSchemaVisualizerProps {
  schema: any;
}

const JSONSchemaVisualizer = ({ schema }: JSONSchemaVisualizerProps) => {
  return (
    <div className="w-full bg-background text-foreground">
      <PropertyNode name={schema.title || "Root"} schema={schema} />
    </div>
  );
};

export default JSONSchemaVisualizer;
