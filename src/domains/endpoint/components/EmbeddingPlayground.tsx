import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { PCA } from "ml-pca";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentListEditor } from "@/domains/endpoint/components/DocumentListEditor";
import { PlaygroundLayout } from "@/domains/endpoint/components/PlaygroundLayout";
import { useDocumentList } from "@/domains/endpoint/hooks/use-document-list";
import { usePlaygroundModels } from "@/domains/endpoint/hooks/use-playground-models";
import type { Endpoint } from "@/domains/endpoint/types";
import { clientPostgrest } from "@/foundation/lib/api";

const INITIAL_DOCUMENTS = [
  {
    id: 1,
    text: "The morning sun lit up the serene countryside, filling the air with warmth and tranquility.",
  },
  {
    id: 2,
    text: "A stormy sky loomed over the countryside, casting a shadow of gloom and unease.",
  },
  {
    id: 3,
    text: "Birds sang melodiously, their tunes weaving joy into the peaceful morning.",
  },
  {
    id: 4,
    text: "Silence prevailed, as even the birds seemed to retreat into stillness.",
  },
  {
    id: 5,
    text: "A soft breeze carried the sweet scent of fresh flowers, uplifting spirits.",
  },
  {
    id: 6,
    text: "The air was heavy and still, tinged with the earthy smell of approaching rain.",
  },
  {
    id: 7,
    text: "The countryside was alive with color and life, a celebration of nature's beauty.",
  },
  {
    id: 8,
    text: "The barren fields stretched endlessly, a stark reminder of life's harshness.",
  },
  {
    id: 9,
    text: "Golden rays danced across the dew-kissed grass, promising a day of happiness.",
  },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover text-popover-foreground p-2 border rounded shadow-sm">
        <p className="text-sm font-medium">{data.text}</p>
      </div>
    );
  }
  return null;
};

const CustomScatterPoint = ({ cx, cy, payload }: any) => {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="hsl(var(--primary))" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(var(--primary-foreground))"
        fontSize="10"
      >
        {payload.index}
      </text>
    </g>
  );
};

type EmbeddingPlaygroundProps = {
  endpoint: Endpoint;
};

export default function EmbeddingPlayground({
  endpoint,
}: EmbeddingPlaygroundProps) {
  const { t } = useTranslation();
  const {
    documents,
    addDocument,
    updateDocument,
    removeDocument,
    clearDocuments,
  } = useDocumentList(INITIAL_DOCUMENTS);
  const [embeddings, setEmbeddings] = useState<
    { index: number; text: string; x: number; y: number }[]
  >([]);
  const [activeTab, setActiveTab] = useState("chart");
  const [batchMode, setBatchMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm({ mode: "all", defaultValues: { model: "" } });
  const { models } = usePlaygroundModels(endpoint, form);
  const selectedModel = form.watch("model");

  const generateEmbeddings = async () => {
    if (!selectedModel) {
      alert(t("components.playground.embedding.selectModelFirst"));
      return;
    }

    const openai = createOpenAI({
      baseURL: `/api/v1/serve-proxy/${endpoint.metadata.workspace}/${endpoint.metadata.name}/v1`,
      apiKey: "no",
      headers: { ...clientPostgrest.headers },
    });

    setIsProcessing(true);
    try {
      const rawEmbeddings = await Promise.all(
        documents.map(async (d) => {
          const { embedding } = await embed({
            model: openai.textEmbeddingModel(selectedModel),
            value: d.text,
          });
          return embedding;
        }),
      );

      const pca = new PCA(rawEmbeddings);
      const pcadata = pca
        .predict(rawEmbeddings, { nComponents: 2 })
        .to2DArray();

      setEmbeddings(
        pcadata.map((v, i) => ({
          index: i + 1,
          text: documents[i].text,
          x: v[0],
          y: v[1],
        })),
      );
    } catch (error) {
      console.error("Error generating embeddings:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    clearDocuments();
    setEmbeddings([]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(generateEmbeddings)} className="h-full">
        <PlaygroundLayout
          title={t("components.playground.embedding.title")}
          actions={
            <>
              <Button
                variant="outline"
                type="button"
                disabled={isProcessing}
                onClick={() => generateEmbeddings()}
              >
                {t("components.playground.embedding.generate")}
              </Button>
              <Button variant="outline" type="button" onClick={clearAll}>
                {t("buttons.clear")}
              </Button>
            </>
          }
          sidebar={
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="batchMode"
                    checked={batchMode}
                    onCheckedChange={(value) => {
                      if (typeof value === "boolean") setBatchMode(value);
                    }}
                  />
                  <Label htmlFor="batchMode">
                    {t("components.playground.embedding.batchInputMode")}
                  </Label>
                </div>
              </div>
              <Controller
                name="model"
                control={form.control}
                render={({ field }) => (
                  <Combobox
                    placeholder={t(
                      "components.playground.embedding.selectModel",
                    )}
                    triggerClassName="sm:w-[300px]"
                    popoverClassName="w-[300px]"
                    options={models}
                    {...field}
                  />
                )}
              />
            </div>
          }
        >
          <div className="space-y-2">
            <h3 className="font-medium">
              {t("components.playground.embedding.documents")}
            </h3>
            <DocumentListEditor
              documents={documents}
              onUpdate={updateDocument}
              onRemove={removeDocument}
              onAdd={addDocument}
              indexMode="id"
              placeholder={t("components.playground.embedding.enterText")}
              addButtonLabel={t("components.playground.embedding.addText")}
            />
          </div>

          <div className="flex items-center px-4 py-2 border-b">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-40 grid-cols-2">
                <TabsTrigger value="chart">
                  {t("components.playground.embedding.chart")}
                </TabsTrigger>
                <TabsTrigger value="json">
                  {t("components.playground.embedding.json")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="chart" className="m-0 w-full">
                <div className="h-[300px] p-2 w-full">
                  {embeddings.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="sentiment"
                          domain={[-1, 1]}
                          tick={<span />}
                          stroke="hsl(var(--foreground))"
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name="nature"
                          domain={[-1, 1]}
                          tick={<span />}
                          stroke="hsl(var(--foreground))"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Scatter
                          data={embeddings}
                          fill="hsl(var(--primary))"
                          shape={<CustomScatterPoint />}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {t("components.playground.embedding.noEmbeddingData")}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="json" className="m-0">
                <ScrollArea className="h-[300px]">
                  <pre className="p-4 text-xs bg-muted/30 text-foreground rounded">
                    {JSON.stringify(embeddings, null, 2)}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </PlaygroundLayout>
      </form>
    </Form>
  );
}
