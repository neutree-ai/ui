import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  field?: {
    value?: Record<string, any>;
    onChange?: (value: Record<string, any>) => void;
  };
}

export const VariablesInput = React.forwardRef<
  HTMLTableElement,
  VariablesInputProps
>(({ value, onChange, schema = {}, field }, ref) => {
  const { t } = useTranslation();

  // Handle both direct props and field props
  // Ensure we always have a valid object, even if the field value is null
  const actualValue =
    field?.value !== undefined ? field.value || {} : value || {};
  const actualOnChange = field?.onChange || onChange;

  const {
    editingRows,
    schemaKeyOptions,
    handleAddNewRow,
    handleEditingKeyChange,
    handleEditingValueChange,
    handleEditingRowBlur,
    handleRemoveEditingRow,
    handleRemoveVariable,
    handleUpdateValue,
  } = useVariablesInput({
    value: actualValue,
    onChange: actualOnChange,
    schema,
  });

  // Track which editing row is focused
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  // Track input refs and dropdown position for portal
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Calculate dropdown position when focused row changes
  useEffect(() => {
    if (focusedRowId && inputRefs.current[focusedRowId]) {
      const input = inputRefs.current[focusedRowId];
      if (input) {
        const rect = input.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    } else {
      setDropdownPosition(null);
    }
  }, [focusedRowId]);

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
              onBlur={() => handleEditingRowBlur(row.id)}
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
              onBlur={() => handleEditingRowBlur(row.id)}
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
        onBlur={() => handleEditingRowBlur(row.id)}
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
            {Object.entries(actualValue).map(([key, val]) => (
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
            {editingRows.map((row) => {
              const isFocused = focusedRowId === row.id;

              // Filter schema options based on current input
              const filteredOptions = !row.key
                ? schemaKeyOptions
                : schemaKeyOptions.filter((opt) => {
                    const searchLower = row.key.toLowerCase();
                    return (
                      opt.value.toLowerCase().includes(searchLower) ||
                      opt.label.toLowerCase().includes(searchLower)
                    );
                  });

              const showSuggestions =
                isFocused &&
                schemaKeyOptions.length > 0 &&
                filteredOptions.length > 0;

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      ref={(el) => {
                        inputRefs.current[row.id] = el;
                      }}
                      value={row.key}
                      onChange={(e) =>
                        handleEditingKeyChange(row.id, e.target.value)
                      }
                      onFocus={() => setFocusedRowId(row.id)}
                      onBlur={() => {
                        setTimeout(() => setFocusedRowId(null), 200);
                        handleEditingRowBlur(row.id);
                      }}
                      placeholder={
                        schemaKeyOptions.length > 0
                          ? t("components.variablesInput.selectOrTypeKey")
                          : t("components.variablesInput.newKey")
                      }
                      className="w-full"
                    />
                    {/* Schema key suggestions dropdown - rendered via portal */}
                    {showSuggestions &&
                      dropdownPosition &&
                      focusedRowId === row.id &&
                      createPortal(
                        <div
                          style={{
                            position: "fixed",
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`,
                            zIndex: 50,
                          }}
                        >
                          <Command className="rounded-lg border shadow-md bg-popover">
                            <CommandList>
                              <CommandEmpty>
                                {t("components.variablesInput.noSchemaKeys")}
                              </CommandEmpty>
                              <CommandGroup className="max-h-[200px] overflow-y-auto">
                                {filteredOptions.map((option) => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => {
                                      handleEditingKeyChange(
                                        row.id,
                                        option.value,
                                      );
                                      setFocusedRowId(null);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {option.label}
                                      </span>
                                      {option.label !== option.value && (
                                        <span className="text-xs text-muted-foreground">
                                          {option.value}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>,
                        document.body,
                      )}
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
              );
            })}
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
