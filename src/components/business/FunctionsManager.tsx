import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Edit, Plus } from "lucide-react";
import { FunctionDialog } from "./FunctionDialog";
import type { ChatFunction } from "@/types/chat-types";
import { cn } from "@/lib/utils";
import { v4 } from "uuid";

interface FunctionsManagerProps {
  functions: ChatFunction[];
  onFunctionsChange: (functions: ChatFunction[]) => void;
}

export function FunctionsManager({
  functions,
  onFunctionsChange,
}: FunctionsManagerProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<
    ChatFunction | undefined
  >();

  const handleCreateFunction = () => {
    setEditingFunction(undefined);
    setDialogOpen(true);
  };

  const handleEditFunction = (func: ChatFunction) => {
    setEditingFunction(func);
    setDialogOpen(true);
  };

  const handleSaveFunction = (
    functionData: Omit<ChatFunction, "id" | "enabled">,
  ) => {
    if (editingFunction) {
      // Update existing function
      const updatedFunctions = functions.map((f) =>
        f.id === editingFunction.id ? { ...f, ...functionData } : f,
      );
      onFunctionsChange(updatedFunctions);
    } else {
      // Create new function
      const newFunction: ChatFunction = {
        ...functionData,
        id: v4(),
        enabled: true,
      };
      onFunctionsChange([...functions, newFunction]);
    }
  };

  const handleDeleteFunction = (id: string) => {
    onFunctionsChange(functions.filter((f) => f.id !== id));
  };

  const handleToggleFunction = (id: string, enabled: boolean) => {
    const updatedFunctions = functions.map((f) =>
      f.id === id ? { ...f, enabled } : f,
    );
    onFunctionsChange(updatedFunctions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>
          {t("components.playground.chat.functions")}
          {functions.filter((f) => f.enabled).length > 0 && (
            <div className="inline-flex items-center ml-2">
              <span className="text-xs text-muted-foreground mr-1">
                {functions.filter((f) => f.enabled).length}
              </span>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          )}
        </Label>
        <Button type="button" size="sm" onClick={handleCreateFunction}>
          <Plus className="w-4 h-4 mr-1" />
          {t("components.playground.chat.createFunction")}
        </Button>
      </div>

      <div className="space-y-2">
        {functions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                {t("components.playground.chat.noFunctions")}
              </p>
            </CardContent>
          </Card>
        ) : (
          functions.map((func) => (
            <Card
              key={func.id}
              className={cn("relative py-2", func.enabled ? "" : "opacity-50")}
            >
              <CardHeader className="p-1 py-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={func.enabled}
                      onCheckedChange={(checked) =>
                        handleToggleFunction(func.id, !!checked)
                      }
                    />
                    <CardTitle className="text-sm">{func.name}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      className="size-6"
                      size="icon"
                      variant="secondary"
                      onClick={() => handleEditFunction(func)}
                    >
                      <Edit />
                    </Button>
                    <Button
                      type="button"
                      className="size-6"
                      size="icon"
                      variant="secondary"
                      onClick={() => handleDeleteFunction(func.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {func.description && (
                <CardContent className="p-1 py-0">
                  <p className="text-xs text-muted-foreground">
                    {func.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      <FunctionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        function={editingFunction}
        onSave={handleSaveFunction}
      />
    </div>
  );
}
