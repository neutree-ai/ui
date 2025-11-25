import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import React from "react";
import { useTranslation } from "react-i18next";
import {
  type EditingRow,
  type Schema,
  useVariablesInput,
} from "./use-variables-input";

interface VariablesInputProps {
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  title?: string;
  schema?: Schema;
}

export const VariablesInput = React.forwardRef<
  HTMLTableElement,
  VariablesInputProps
>(({ value = {}, onChange = () => {}, schema = {} }, ref) => {
  const { t } = useTranslation();
  const {
    editingRows,
    handleAddNewRow,
    handleEditingKeyChange,
    handleEditingValueChange,
    handleEditingRowKeyDown,
    handleRemoveEditingRow,
    handleRemoveVariable,
    handleUpdateValue,
  } = useVariablesInput({ value, onChange, schema });

  // Render appropriate input based on schema type for existing variables
  const renderValueInput = (key: string, val: any) => {
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

  // Render value input for editing rows
  const renderEditingValueInput = (row: EditingRow) => {
    if (row.key && schema[row.key]) {
      const { type } = schema[row.key];

      switch (type) {
        case "boolean":
          return (
            <Select
              value={row.value}
              onValueChange={(value) => handleEditingValueChange(row.id, value)}
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
              value={row.value}
              step="any"
              onChange={(e) => handleEditingValueChange(row.id, e.target.value)}
              onKeyDown={(e) => handleEditingRowKeyDown(row.id, e)}
              className="w-full"
            />
          );
        case "integer":
          return (
            <Input
              type="number"
              placeholder={t("components.variablesInput.newValue")}
              value={row.value}
              step="1"
              onChange={(e) => handleEditingValueChange(row.id, e.target.value)}
              onKeyDown={(e) => handleEditingRowKeyDown(row.id, e)}
              className="w-full"
            />
          );
      }
    }

    // Default string input
    return (
      <Input
        placeholder={t("components.variablesInput.newValue")}
        value={row.value}
        onChange={(e) => handleEditingValueChange(row.id, e.target.value)}
        onKeyDown={(e) => handleEditingRowKeyDown(row.id, e)}
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
            {/* Existing variables - directly editable */}
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
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVariable(key)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {/* Editing rows */}
            {editingRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Input
                    value={row.key}
                    onChange={(e) =>
                      handleEditingKeyChange(row.id, e.target.value)
                    }
                    onKeyDown={(e) => handleEditingRowKeyDown(row.id, e)}
                    placeholder={t("components.variablesInput.newKey")}
                    className="w-full"
                  />
                </TableCell>
                <TableCell>{renderEditingValueInput(row)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEditingRow(row.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Bottom + button */}
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddNewRow}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("components.variablesInput.addVariable")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

VariablesInput.displayName = "VariablesInput";

export default VariablesInput;
