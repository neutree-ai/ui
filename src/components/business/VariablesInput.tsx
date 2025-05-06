import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash } from "lucide-react";

// Define schema types
type SchemaPropertyType = "string" | "number" | "boolean" | "integer" | "float";

interface SchemaProperty {
  type: SchemaPropertyType;
  title?: string;
  description?: string;
}

export interface Schema {
  [key: string]: SchemaProperty;
}

interface VariablesInputProps {
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  title?: string;
  schema?: Schema;
}

export const VariablesInput = React.forwardRef<
  HTMLTableElement,
  VariablesInputProps
>(
  (
    {
      value = {},
      onChange = () => {
        //
      },
      schema = {},
    },
    ref,
  ) => {
    const [newKey, setNewKey] = useState<string>("");
    const [newValue, setNewValue] = useState<string>("");
    const [availableSchemaKeys, setAvailableSchemaKeys] = useState<string[]>(
      [],
    );

    // Update available schema keys that aren't already in use
    useEffect(() => {
      const usedKeys = Object.keys(value);
      const schemaKeys = Object.keys(schema);
      setAvailableSchemaKeys(
        schemaKeys.filter((key) => !usedKeys.includes(key)),
      );
    }, [value, schema]);

    const handleAddVariable = () => {
      if (!newKey.trim()) return;

      // Convert value based on schema type if the key exists in schema
      let processedValue: any = newValue;
      if (schema[newKey]) {
        const type = schema[newKey].type;
        if (type === "number" || type === "float") {
          processedValue = newValue === "" ? "" : Number.parseFloat(newValue);
        } else if (type === "integer") {
          processedValue = newValue === "" ? "" : Number.parseInt(newValue, 10);
        } else if (type === "boolean") {
          processedValue = newValue === "true";
        }
      }

      const updatedVariables = {
        ...value,
        [newKey]: processedValue,
      };

      onChange(updatedVariables);
      setNewKey("");
      setNewValue("");
    };

    const handleRemoveVariable = (key: string) => {
      const updatedVariables = { ...value };
      delete updatedVariables[key];
      onChange(updatedVariables);
    };

    const handleUpdateValue = (key: string, newVal: any) => {
      onChange({
        ...value,
        [key]: newVal,
      });
    };

    // Render appropriate input based on schema type
    const renderValueInput = (key: string, val: any) => {
      // If key is in schema, render appropriate input
      if (schema[key]) {
        const { type } = schema[key];

        switch (type) {
          case "boolean":
            return (
              <Checkbox
                checked={Boolean(val)}
                onCheckedChange={(checked) => handleUpdateValue(key, checked)}
              />
            );
          case "number":
          case "float":
            return (
              <Input
                type="number"
                value={val}
                step="any"
                onChange={(e) =>
                  handleUpdateValue(key, Number.parseFloat(e.target.value))
                }
                className="w-full"
              />
            );
          case "integer":
            return (
              <Input
                type="number"
                value={val}
                step="1"
                onChange={(e) =>
                  handleUpdateValue(key, Number.parseInt(e.target.value, 10))
                }
                className="w-full"
              />
            );
          default:
            return (
              <Input
                value={val}
                onChange={(e) => handleUpdateValue(key, e.target.value)}
                className="w-full"
              />
            );
        }
      }

      // Default to string input for unknown types
      return (
        <Input
          value={val}
          onChange={(e) => handleUpdateValue(key, e.target.value)}
          className="w-full"
        />
      );
    };

    // Handle new value input based on selected key's schema
    const renderNewValueInput = () => {
      if (newKey && schema[newKey]) {
        const { type } = schema[newKey];

        switch (type) {
          case "boolean":
            return (
              <Select
                value={newValue}
                onValueChange={(value) => setNewValue(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            );
          case "number":
          case "float":
            return (
              <Input
                type="number"
                placeholder="New value"
                value={newValue}
                step="any"
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full"
              />
            );
          case "integer":
            return (
              <Input
                type="number"
                placeholder="New value"
                value={newValue}
                step="1"
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full"
              />
            );
        }
      }

      // Default string input
      return (
        <Input
          placeholder="New value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="w-full"
        />
      );
    };

    return (
      <Card className="w-full">
        <CardContent className="p-2">
          <Table ref={ref}>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(value).map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">
                    {key}
                    {schema[key]?.title && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({schema[key].title})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{renderValueInput(key, val)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveVariable(key)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* Add new variable row */}
              <TableRow>
                <TableCell>
                  {availableSchemaKeys.length > 0 ? (
                    <div className="flex gap-2">
                      <Select value={newKey} onValueChange={setNewKey}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select or type key" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSchemaKeys.map((key) => (
                            <SelectItem key={key} value={key}>
                              {schema[key]?.title || key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Or type custom key"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <Input
                      placeholder="New key"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-full"
                    />
                  )}
                </TableCell>
                <TableCell>{renderNewValueInput()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleAddVariable}
                    disabled={!newKey.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  },
);

export default VariablesInput;
