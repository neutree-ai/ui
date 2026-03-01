import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChatFunction } from "@/foundation/types/chat-types";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface FunctionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  function?: ChatFunction;
  onSave: (functionData: Omit<ChatFunction, "id" | "enabled">) => void;
}

interface FormData {
  name: string;
  description: string;
  parameters: string;
}

const FUNCTION_EXAMPLES = [
  {
    name: "get_weather",
    description: "Determine weather in my location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and state e.g. San Francisco, CA",
        },
        unit: {
          type: "string",
          enum: ["c", "f"],
        },
      },
      additionalProperties: false,
      required: ["location", "unit"],
    },
  },
  {
    name: "get_stock_price",
    description: "Get the current stock price",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The stock symbol",
        },
      },
      additionalProperties: false,
      required: ["symbol"],
    },
  },
];

export function FunctionDialog({
  open,
  onOpenChange,
  function: editFunction,
  onSave,
}: FunctionDialogProps) {
  const { t } = useTranslation();
  const [_parameterFields, setParameterFields] = useState<string[]>([]);
  const [parameterError, setParameterError] = useState<string>("");

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      parameters: '{\n  "type": "object",\n  "properties": {\n  }\n}',
    },
  });

  const parametersValue = watch("parameters");

  // Extract field names from JSON schema
  useEffect(() => {
    try {
      const schema = JSON.parse(parametersValue);
      if (schema?.properties && typeof schema.properties === "object") {
        const fields = Object.keys(schema.properties);
        setParameterFields(fields);
        setParameterError("");
      } else {
        setParameterFields([]);
      }
    } catch {
      setParameterError(t("components.playground.chat.invalidJsonSchema"));
      setParameterFields([]);
    }
  }, [parametersValue, t]);

  const loadExample = (exampleIndex: number) => {
    const example = FUNCTION_EXAMPLES[exampleIndex];
    if (example) {
      setValue("name", example.name);
      setValue("description", example.description);
      setValue("parameters", JSON.stringify(example.parameters, null, 2));
    }
  };

  // Initialize form when editing
  useEffect(() => {
    if (editFunction) {
      reset({
        name: editFunction.name,
        description: editFunction.description || "",
        parameters: JSON.stringify(editFunction.parameters, null, 2),
      });
    } else {
      reset({
        name: "",
        description: "",
        parameters: '{\n  "type": "object",\n  "properties": {\n  }\n}',
      });
    }
  }, [editFunction, reset]);

  const onSubmit = (data: FormData) => {
    try {
      const parameters = JSON.parse(data.parameters);
      onSave({
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        parameters,
      });
      onOpenChange(false);
    } catch {
      setParameterError(t("components.playground.chat.invalidJsonSchema"));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSubmit(onSubmit)(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editFunction
              ? t("components.playground.chat.editFunction")
              : t("components.playground.chat.createFunction")}
          </DialogTitle>
        </DialogHeader>

        {/* Example Selector */}
        <div className="flex items-center justify-between px-1">
          <div className="text-sm text-muted-foreground">
            {t("components.playground.chat.loadFromExample")}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t("components.playground.chat.chooseExample")}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => loadExample(0)}>
                {t("components.playground.chat.weatherFunction")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadExample(1)}>
                {t("components.playground.chat.stockPriceFunction")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t("components.playground.chat.functionName")}
            </Label>
            <Controller
              name="name"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder={t(
                    "components.playground.chat.functionNamePlaceholder",
                  )}
                  required
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t("components.playground.chat.functionDescription")}
            </Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder={t(
                    "components.playground.chat.functionDescriptionPlaceholder",
                  )}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parameters">
              {t("components.playground.chat.parameters")}
            </Label>
            <Controller
              name="parameters"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  placeholder={t(
                    "components.playground.chat.parametersPlaceholder",
                  )}
                  className="font-mono text-sm min-h-[200px]"
                />
              )}
            />
            {parameterError && (
              <p className="text-sm text-red-600">{parameterError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("buttons.cancel")}
            </Button>
            <Button type="submit" disabled={!!parameterError}>
              {editFunction ? t("buttons.save") : t("buttons.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
