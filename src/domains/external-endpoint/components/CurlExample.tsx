import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  Select as SelectUI,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildAnthropicCurlCommand } from "@/domains/external-endpoint/lib/build-anthropic-curl-command";
import { buildOpenAICurlCommand } from "@/domains/external-endpoint/lib/build-curl-command";
import { buildEmbeddingCurlCommand } from "@/domains/external-endpoint/lib/build-embedding-curl-command";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type CurlExampleProps = {
  serviceUrl: string;
  models: string[];
};

export default function CurlExample({ serviceUrl, models }: CurlExampleProps) {
  const { t } = useTranslation();
  const { current: workspace } = useWorkspace();
  const [selectedModel, setSelectedModel] = useState(models[0] || "model-name");
  const [activeTab, setActiveTab] = useState("openai");
  const { copy, copied } = useCopyToClipboard();

  const curlCommand = (() => {
    switch (activeTab) {
      case "anthropic":
        return buildAnthropicCurlCommand(serviceUrl, selectedModel);
      case "embedding":
        return buildEmbeddingCurlCommand(serviceUrl, selectedModel);
      default:
        return buildOpenAICurlCommand(serviceUrl, selectedModel);
    }
  })();

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm">
          {t("external_endpoints.messages.curlExample")}
        </CardTitle>
        <div className="flex items-center gap-2">
          {models.length > 1 && (
            <SelectUI value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectUI>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              copy(curlCommand, {
                successMessage: t("components.apiKey.copySuccess"),
                errorMessage: t("components.apiKey.errors.copyFailed"),
              })
            }
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="mb-3 text-sm text-muted-foreground">
          {t("external_endpoints.messages.curlHint", {
            exportCmd: "{{exportCmd}}",
            apiKeyPage: "{{apiKeyPage}}",
          })
            .split(/({{exportCmd}}|{{apiKeyPage}})/)
            .map((segment, i) => {
              if (segment === "{{exportCmd}}") {
                return (
                  <code
                    key={i}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
                  >
                    export ENDPOINT_API_KEY=&lt;your-key&gt;
                  </code>
                );
              }
              if (segment === "{{apiKeyPage}}") {
                return (
                  <Link
                    key={i}
                    to={`/${workspace}/api-keys`}
                    className="text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    {t("api_keys.title")}
                  </Link>
                );
              }
              return segment;
            })}
        </p>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="openai">
              {t("external_endpoints.messages.curlExampleOpenai")}
            </TabsTrigger>
            <TabsTrigger value="anthropic">
              {t("external_endpoints.messages.curlExampleAnthropic")}
            </TabsTrigger>
            <TabsTrigger value="embedding">
              {t("external_endpoints.messages.curlExampleEmbedding")}
            </TabsTrigger>
          </TabsList>
          {["openai", "anthropic", "embedding"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                <code>{curlCommand}</code>
              </pre>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
