import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, TrashIcon } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useForm, Controller } from "react-hook-form";
import { useState } from "react";
import { useCustom } from "@refinedev/core";
import type { Endpoint } from "@/types";
import { PCA } from "ml-pca";
import { embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// Custom tooltip to show the text content when hovering on a point
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border rounded shadow-sm">
        <p className="text-sm font-medium">{data.text}</p>
      </div>
    );
  }
  return null;
};

// Custom scatter point with text label
const CustomScatterPoint = ({ cx, cy, payload }: any) => {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#3b82f6" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="10"
      >
        {payload.index}
      </text>
    </g>
  );
};

type FormValue = {
  model: string;
};

type EmbeddingPlaygroundProps = {
  endpoint: Endpoint;
};

export default function EmbeddingPlayground({
  endpoint,
}: EmbeddingPlaygroundProps) {
  const [documents, setDocuments] = useState([
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
  ]);

  const [embeddings, setEmbeddings] = useState<
    { index: number; text: string; x: number; y: number }[]
  >([]);
  const [activeTab, setActiveTab] = useState("chart");
  const [batchMode, setBatchMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const { ...form } = useForm({
    mode: "all",
    defaultValues: {
      model: "",
    },
  });

  // Fetch available models
  const modelsData = useCustom({
    url: `/serve-proxy/${endpoint?.metadata?.name}/v1/models`,
    method: "get",
    queryOptions: {
      enabled: Boolean(endpoint?.metadata?.name),
    },
  });

  const models = (modelsData.data?.data?.data || []).map((v: any) => ({
    label: v.id,
    value: v.id,
  }));

  // Function to add a new document
  const addDocument = () => {
    const newId =
      documents.length > 0 ? Math.max(...documents.map((d) => d.id)) + 1 : 1;
    setDocuments([...documents, { id: newId, text: "" }]);
  };

  // Function to update a document
  const updateDocument = (id: number, text: string) => {
    setDocuments(
      documents.map((doc) => (doc.id === id ? { ...doc, text } : doc)),
    );
  };

  // Function to remove a document
  const removeDocument = (id: number) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  // Function to generate embeddings
  const generateEmbeddings = async () => {
    if (!form.getValues().model) {
      alert("Please select a model first");
      return;
    }

    const serviceUrl = endpoint.status?.service_url;

    const openai = createOpenAI({
      baseURL: `/api/v1/serve-proxy/${endpoint?.metadata?.name}/v1`,
      apiKey: "no",
    });

    setIsProcessing(true);
    try {
      const embeddings = await Promise.all(
        documents.map(async (d) => {
          const { embedding } = await embed({
            model: openai.textEmbeddingModel(form.getValues().model),
            value: d.text,
          });
          return embedding;
        }),
      );

      const pca = new PCA(embeddings);
      const pcadata = pca.predict(embeddings, { nComponents: 2 }).to2DArray();

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

  // Function to clear all documents
  const clearAll = () => {
    setDocuments([]);
    setEmbeddings([]);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(generateEmbeddings)}
        className="h-full overflow-auto"
      >
        <div className="h-full flex-col">
          <div className="container h-full py-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Embedding</h2>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={isProcessing}
                  onClick={() => generateEmbeddings()}
                >
                  Generate
                </Button>
                <Button variant="outline" onClick={clearAll}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_300px]">
              <div className="flex-col space-y-4 sm:flex md:order-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="batchMode"
                        checked={batchMode}
                        onCheckedChange={(value) => {
                          if (typeof value === "boolean") {
                            setBatchMode(value);
                          }
                        }}
                      />
                      <Label htmlFor="batchMode">Batch Input Mode</Label>
                    </div>
                  </div>

                  <Controller
                    name="model"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        placeholder="Select a model"
                        triggerClassName="sm:w-[300px]"
                        popoverClassName="w-[300px]"
                        options={models}
                        {...field}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="md:order-1 space-y-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Documents</h3>
                  <ScrollArea className="h-[400px] rounded-md border">
                    <div className="p-4 space-y-4">
                      {documents.map((doc, index) => (
                        <div
                          key={doc.id}
                          className="flex items-center space-x-2"
                        >
                          <div className="flex-none w-8 h-8 flex items-center justify-center bg-gray-100 rounded">
                            {doc.id}
                          </div>
                          <Textarea
                            value={doc.text}
                            onChange={(e) =>
                              updateDocument(doc.id, e.target.value)
                            }
                            placeholder="Enter text..."
                            className="flex-1 min-h-12"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={addDocument}
                      >
                        <PlusIcon className="h-4 w-4 mr-2" /> Add Text
                      </Button>
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex items-center px-4 py-2 border-b">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-40 grid-cols-2">
                      <TabsTrigger value="chart">Chart</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                    </TabsList>
                    <TabsContent value="chart" className="m-0 w-full">
                      <div className="h-[300px] p-2 w-full">
                        {embeddings.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart
                              margin={{
                                top: 20,
                                right: 20,
                                bottom: 20,
                                left: 20,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                type="number"
                                dataKey="x"
                                name="sentiment"
                                domain={[-1, 1]}
                                tick={<span />}
                              />
                              <YAxis
                                type="number"
                                dataKey="y"
                                name="nature"
                                domain={[-1, 1]}
                                tick={<span />}
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Scatter
                                data={embeddings}
                                fill="#8884d8"
                                shape={<CustomScatterPoint />}
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            No embedding data to display
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="json" className="m-0">
                      <ScrollArea className="h-[300px]">
                        <pre className="p-4 text-xs">
                          {JSON.stringify(embeddings, null, 2)}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
