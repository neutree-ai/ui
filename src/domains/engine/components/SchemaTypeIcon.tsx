import { Box, CheckSquare, Hash, List, Type, XSquare } from "lucide-react";

interface SchemaTypeIconProps {
  type: string;
}

export const SchemaTypeIcon = ({ type }: SchemaTypeIconProps) => {
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
