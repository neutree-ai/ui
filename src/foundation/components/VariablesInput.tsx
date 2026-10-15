import { Plus, Trash } from "lucide-react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  type FieldPath,
  type FieldValues,
  useFormContext,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  type EditingRow,
  INVALID_JSON_ERROR,
  type Schema,
  useVariablesInput,
} from "@/foundation/hooks/use-variables-input";
import { ResourceFormSubmitContext } from "./resource-form-submit-context";

/** What an overriding input is handed: the current value and a way to replace it. */
interface VariableValueInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Replacement inputs for particular argument keys.
 *
 * Which key deserves which input is the caller's judgement, not this
 * component's: an input that has to reach an API belongs to whoever knows which
 * API, and which arguments an engine has is knowledge this generic key/value
 * editor has no business holding.
 */
type VariableValueInputs = Record<
  string,
  (props: VariableValueInputProps) => React.ReactNode
>;

interface VariablesInputProps {
  name?: string;
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  title?: string;
  schema?: Schema;
  valueInputs?: VariableValueInputs;
  field?: {
    value?: Record<string, unknown>;
    onChange?: (value: Record<string, unknown>) => void;
  };
}

export const VariablesInput = React.forwardRef<
  HTMLTableElement,
  VariablesInputProps
>(({ name, value, onChange, schema = {}, valueInputs = {}, field }, ref) => {
  const { t } = useTranslation();
  const form = useFormContext<FieldValues>();
  const submitContext = useContext(ResourceFormSubmitContext);

  // Handle both direct props and field props
  // Ensure we always have a valid object, even if the field value is null
  const actualValue =
    field?.value !== undefined ? field.value || {} : value || {};
  const actualOnChange = field?.onChange || onChange;

  const {
    editingRows,
    editingRowErrors,
    schemaKeyOptions,
    handleAddNewRow,
    handleEditingKeyChange,
    handleEditingValueChange,
    handleRemoveEditingRow,
    handleRemoveVariable,
    handleUpdateValue,
    saveEditingRow,
    saveEditingRows,
  } = useVariablesInput({
    value: actualValue,
    onChange: actualOnChange,
    schema,
  });

  // Track which editing row is focused
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  // Track input refs and dropdown position for portal
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hasManagedJsonErrorRef = useRef(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [jsonValueDrafts, setJsonValueDrafts] = useState<
    Record<string, string>
  >({});
  const [jsonValueErrors, setJsonValueErrors] = useState<
    Record<string, string>
  >({});

  const setFormJsonError = useCallback(() => {
    if (!name || !form) return;
    hasManagedJsonErrorRef.current = true;
    form.setError(name as FieldPath<FieldValues>, {
      type: "manual",
      message: t(INVALID_JSON_ERROR),
    });
  }, [form, name, t]);

  const saveEditingRowNow = (id: string) => {
    flushSync(() => {
      saveEditingRow(id);
    });
  };

  useEffect(() => {
    if (!name || !form) return;
    const hasJsonError =
      Object.keys(jsonValueErrors).length > 0 ||
      Object.keys(editingRowErrors).length > 0;
    if (hasJsonError) {
      hasManagedJsonErrorRef.current = true;
      form.setError(name as FieldPath<FieldValues>, {
        type: "manual",
        message: t(INVALID_JSON_ERROR),
      });
      return;
    }
    if (!hasManagedJsonErrorRef.current) return;
    hasManagedJsonErrorRef.current = false;
    form.clearErrors(name as FieldPath<FieldValues>);
  }, [editingRowErrors, form, jsonValueErrors, name, t]);

  const handleRemoveJsonVariable = (key: string) => {
    setJsonValueDrafts((prev) => {
      if (!Object.hasOwn(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setJsonValueErrors((prev) => {
      if (!Object.hasOwn(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    handleRemoveVariable(key);
  };

  useLayoutEffect(() => {
    return submitContext?.registerBeforeSubmit(() => {
      let isValid = true;
      flushSync(() => {
        isValid = saveEditingRows(editingRows.map((row) => row.id));
      });
      if (!isValid) {
        setFormJsonError();
        return false;
      }
      return true;
    });
  }, [editingRows, saveEditingRows, setFormJsonError, submitContext]);

  const formatJsonValue = (val: unknown) =>
    typeof val === "string" ? val : JSON.stringify(val, null, 2);

  const formatPrimitiveValue = (val: unknown) => {
    if (typeof val === "string" || typeof val === "number") return val;
    return val == null ? "" : String(val);
  };

  const handleExistingJsonValueChange = (key: string, rawValue: string) => {
    const type = schema[key]?.type;
    if (type !== "object" && type !== "array") return;

    setJsonValueDrafts((prev) => ({ ...prev, [key]: rawValue }));
    try {
      const parsed = JSON.parse(rawValue);
      const matchesType =
        type === "array"
          ? Array.isArray(parsed)
          : typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed);
      if (matchesType) {
        setJsonValueErrors((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
        flushSync(() => {
          handleUpdateValue(key, parsed);
        });
      } else {
        setJsonValueErrors((prev) => ({
          ...prev,
          [key]: INVALID_JSON_ERROR,
        }));
        setFormJsonError();
      }
    } catch {
      setJsonValueErrors((prev) => ({
        ...prev,
        [key]: INVALID_JSON_ERROR,
      }));
      setFormJsonError();
    }
  };

  useEffect(() => {
    setJsonValueErrors((prev) => {
      const nextErrors: Record<string, string> = {};
      for (const [key, val] of Object.entries(actualValue)) {
        if (Object.hasOwn(jsonValueDrafts, key)) {
          if (prev[key]) nextErrors[key] = prev[key];
          continue;
        }
        const type = schema[key]?.type;
        if (type !== "object" && type !== "array") continue;
        if (typeof val !== "string") continue;
        try {
          const parsed = JSON.parse(val);
          const matchesType =
            type === "array"
              ? Array.isArray(parsed)
              : typeof parsed === "object" &&
                parsed !== null &&
                !Array.isArray(parsed);
          if (!matchesType) {
            nextErrors[key] = INVALID_JSON_ERROR;
          }
        } catch {
          nextErrors[key] = INVALID_JSON_ERROR;
        }
      }
      if (
        Object.keys(prev).length === Object.keys(nextErrors).length &&
        Object.entries(nextErrors).every(([key, error]) => prev[key] === error)
      ) {
        return prev;
      }
      return nextErrors;
    });
  }, [actualValue, jsonValueDrafts, schema]);

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
  const renderValueInput = (key: string, val: unknown) => {
    if (schema[key]) {
      const { type } = schema[key];

      // An input the caller supplied for this key wins over the type's own.
      // Anything else falls through, so a key the caller says nothing about
      // keeps the input its type implies.
      const override = valueInputs[key];

      if (override) {
        return override({
          value: String(formatPrimitiveValue(val) ?? ""),
          onChange: (next) => handleUpdateValue(key, next),
        });
      }

      if (Array.isArray(type)) {
        return (
          <Input
            type="text"
            value={formatPrimitiveValue(val)}
            pattern={schema[key].pattern}
            onChange={(e) => handleUpdateValue(key, e.target.value)}
            className="w-full"
          />
        );
      }

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
              value={formatPrimitiveValue(val)}
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
              value={formatPrimitiveValue(val)}
              step="1"
              onChange={(e) =>
                handleUpdateValue(key, Number.parseInt(e.target.value, 10))
              }
              className="w-full"
            />
          );
        case "object":
        case "array":
          return (
            <div className="space-y-1">
              <Textarea
                value={jsonValueDrafts[key] ?? formatJsonValue(val)}
                onChange={(e) =>
                  handleExistingJsonValueChange(key, e.target.value)
                }
                className="min-h-24 w-full font-mono text-sm"
              />
              {jsonValueErrors[key] && (
                <p className="text-xs text-destructive">
                  {t(jsonValueErrors[key])}
                </p>
              )}
            </div>
          );
        default:
          return (
            <Input
              value={formatPrimitiveValue(val)}
              pattern={schema[key].pattern}
              onChange={(e) => handleUpdateValue(key, e.target.value)}
              className="w-full"
            />
          );
      }
    }

    // Default to string input for unknown types
    return (
      <Input
        value={formatPrimitiveValue(val)}
        onChange={(e) => handleUpdateValue(key, e.target.value)}
        className="w-full"
      />
    );
  };

  // Render value input for editing rows
  const renderEditingValueInput = (row: EditingRow) => {
    if (row.key && schema[row.key]) {
      const { type } = schema[row.key];

      // A row being drafted gets the same replacement input a saved one does.
      // Without this the two halves of the table disagree: a key the caller has
      // supplied an input for showed a plain text box until the row had been
      // filled in and committed, so the input only appeared once it was no
      // longer needed. Whoever added the key had to guess a value, blur, and
      // come back.
      //
      // Committing on blur rather than on change is deliberate. These inputs
      // hand back a whole value at once, but they are typeable too, and saving
      // mid-word would move the row out of the drafting section and remount the
      // input under the cursor. Blur is what every other draft input here does,
      // and the form's before-submit hook saves anything still unblurred.
      const override = valueInputs[row.key];

      if (override) {
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: blur only, to commit the row
          <div onBlur={() => saveEditingRowNow(row.id)}>
            {override({
              value: row.value,
              onChange: (next) => handleEditingValueChange(row.id, next),
            })}
          </div>
        );
      }

      if (Array.isArray(type)) {
        return (
          <div className="space-y-1">
            <Input
              type="text"
              placeholder={t("components.variablesInput.newValue")}
              value={row.value}
              pattern={schema[row.key].pattern}
              aria-invalid={Boolean(editingRowErrors[row.id])}
              onChange={(e) => handleEditingValueChange(row.id, e.target.value)}
              onBlur={() => saveEditingRowNow(row.id)}
              className="w-full"
            />
            {editingRowErrors[row.id] && (
              <p className="text-xs text-destructive">
                {t(editingRowErrors[row.id])}
              </p>
            )}
          </div>
        );
      }

      switch (type) {
        case "boolean":
          return (
            <Checkbox
              checked={row.value === "true"}
              onCheckedChange={(checked) => {
                flushSync(() => {
                  handleEditingValueChange(
                    row.id,
                    checked === true ? "true" : "false",
                  );
                });
                saveEditingRowNow(row.id);
              }}
            />
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
              onBlur={() => saveEditingRowNow(row.id)}
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
              onBlur={() => saveEditingRowNow(row.id)}
              className="w-full"
            />
          );
        case "object":
        case "array":
          return (
            <div className="space-y-1">
              <Textarea
                placeholder={t("components.variablesInput.newValue")}
                value={row.value}
                onChange={(e) =>
                  handleEditingValueChange(row.id, e.target.value)
                }
                onBlur={() => saveEditingRowNow(row.id)}
                className="min-h-24 w-full font-mono text-sm"
              />
              {editingRowErrors[row.id] && (
                <p className="text-xs text-destructive">
                  {t(editingRowErrors[row.id])}
                </p>
              )}
            </div>
          );
      }
    }

    // Default string input
    return (
      <Input
        placeholder={t("components.variablesInput.newValue")}
        value={row.value}
        onChange={(e) => handleEditingValueChange(row.id, e.target.value)}
        onBlur={() => saveEditingRowNow(row.id)}
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
                    data-testid="remove-variable"
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveJsonVariable(key)}
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
                      data-testid="remove-variable"
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
