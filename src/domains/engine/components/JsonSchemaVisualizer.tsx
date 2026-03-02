import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/foundation/lib/i18n";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { getTypeColorClass } from "../lib/schema-type-color";
import { SchemaTypeIcon } from "./SchemaTypeIcon";

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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren =
    (schema.type === "object" && schema.properties) ||
    (schema.type === "array" && schema.items);

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

        {required && (
          <Badge variant="destructive" className="ml-2 text-xs">
            {t("components.jsonSchemaVisualizer.required")}
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
  const { t } = useTranslation();

  return (
    <div className="w-full bg-background text-foreground">
      <PropertyNode
        name={schema.title || t("components.jsonSchemaVisualizer.root")}
        schema={schema}
      />
    </div>
  );
};

export default JSONSchemaVisualizer;
