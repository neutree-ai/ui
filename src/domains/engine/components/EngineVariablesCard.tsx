import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import JSONSchemaValueVisualizer from "./JsonSchemaValueVisualizer";

interface EngineVariablesCardProps {
  // biome-ignore lint/suspicious/noExplicitAny: schema is a dynamic JSON schema object
  schema: any;
  // biome-ignore lint/suspicious/noExplicitAny: variables can contain any valid JSON values
  variables: Record<string, any> | null;
  useNestedPath?: boolean;
}

export default function EngineVariablesCard({
  schema,
  variables,
  useNestedPath = false,
}: EngineVariablesCardProps) {
  const { t } = useTranslation();

  if (!schema || !variables) {
    return null;
  }

  const variableValue = useNestedPath ? variables.engine_args : variables;

  if (!variableValue) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("common.fields.variables")}</CardTitle>
      </CardHeader>
      <CardContent>
        <JSONSchemaValueVisualizer schema={schema} value={variableValue} />
      </CardContent>
    </Card>
  );
}
