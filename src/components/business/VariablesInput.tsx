import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash } from "lucide-react";
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
    const [newKey, setNewKey] = useState<string>("");
    const [newValue, setNewValue] = useState<string>("");

    const availableSchemaKeys = useMemo(() => {
      const usedKeys = Object.keys(value);
      const schemaKeys = Object.keys(schema);
      return schemaKeys.filter((key) => !usedKeys.includes(key));
    }, [value, schema]);

    const schemaKeyOptions = useMemo(() => {
      return availableSchemaKeys.map((key) => ({
        label: schema[key]?.title || key,
        value: key,
      }));
    }, [availableSchemaKeys, schema]);

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
                  <SelectValue
                    placeholder={t("components.variablesInput.selectValue")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">
                    {t("components.variablesInput.true")}
                  </SelectItem>
                  <SelectItem value="false">
                    {t("components.variablesInput.false")}
                  </SelectItem>
                </SelectContent>
              </Select>
            );
          case "number":
          case "float":
            return (
              <Input
                type="number"
                placeholder={t("components.variablesInput.newValue")}
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
                placeholder={t("components.variablesInput.newValue")}
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
          placeholder={t("components.variablesInput.newValue")}
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
                <TableHead>{t("components.variablesInput.key")}</TableHead>
                <TableHead>{t("components.variablesInput.value")}</TableHead>
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
                      <Combobox
                        value={
                          availableSchemaKeys.includes(newKey) ? newKey : ""
                        }
                        onChange={setNewKey}
                        options={schemaKeyOptions}
                        placeholder={t(
                          "components.variablesInput.selectFromSchema",
                        )}
                        asField={false}
                      />
                      <Input
                        placeholder={t(
                          "components.variablesInput.orTypeCustomKey",
                        )}
                        value={
                          availableSchemaKeys.includes(newKey) ? "" : newKey
                        }
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <Input
                      placeholder={t("components.variablesInput.newKey")}
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
