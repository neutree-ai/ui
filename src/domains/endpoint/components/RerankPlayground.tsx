import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Endpoint } from "@/domains/endpoint/types";
import { useCustom, useCustomMutation } from "@refinedev/core";
import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

const getRankChangeDisplay = (change: number) => {
  if (change > 0) {
    return {
      icon: (
        <div className="h-3 w-3">
          <ArrowUp className="h-3 w-3" />
        </div>
      ),
      text: `+${change}`,
      className: "text-green-600 dark:text-green-400",
    };
  }

  if (change < 0) {
    return {
      icon: <ArrowDown className="h-3 w-3" />,
      text: `${change}`,
      className: "text-red-600 dark:text-red-400",
    };
  }

  return {
    icon: <Minus className="h-3 w-3" />,
    text: "0",
    className: "text-muted-foreground",
  };
};

type FormValue = {
  model: string;
  query: string;
};

type Document = {
  id: number;
  text: string;
  originalIndex: number;
};

type RankedDocument = Document & {
  score: number;
  rankChange: number;
  newRank: number;
};

type RerankPlaygroundProps = {
  endpoint: Endpoint;
};

export default function RerankPlayground({ endpoint }: RerankPlaygroundProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 1,
      text: "Paris is the capital and largest city of France.",
      originalIndex: 0,
    },
    {
      id: 2,
      text: "The Eiffel Tower is located in Paris and is one of the most famous landmarks.",
      originalIndex: 1,
    },
    {
      id: 3,
      text: "London is the capital city of England and the United Kingdom.",
      originalIndex: 2,
    },
    {
      id: 4,
      text: "The weather in Paris is generally mild with warm summers.",
      originalIndex: 3,
    },
    {
      id: 5,
      text: "Berlin is the capital and largest city of Germany.",
      originalIndex: 4,
    },
  ]);

  const [rankedDocuments, setRankedDocuments] = useState<RankedDocument[]>([]);
  const [activeTab, setActiveTab] = useState("documents");
  const [isProcessing, setIsProcessing] = useState(false);

  const { ...form } = useForm({
    mode: "all",
    defaultValues: {
      model: "",
      query: "What is the capital of France?",
    },
  });

  // Fetch available models
  const modelsData = useCustom({
    url: `/serve-proxy/${endpoint.metadata.workspace}/${endpoint.metadata.name}/v1/models`,
    method: "get",
    queryOptions: {
      enabled: Boolean(endpoint?.metadata?.name),
    },
  });

  const models = (modelsData.data?.data?.data || []).map(
    (v: { id: string }) => ({
      label: v.id,
      value: v.id,
    }),
  );

  const selectedModel = form.watch("model");

  // Use mutation for rerank API call
  const { mutateAsync: rerankMutation } = useCustomMutation();

  // Auto-select first model when models data is loaded and has results
  useEffect(() => {
    const modelList = modelsData.data?.data?.data || [];
    if (modelList.length > 0 && !selectedModel) {
      form.setValue("model", modelList[0].id);
    }
  }, [modelsData.data, form.setValue, selectedModel]);

  // Function to add a new document
  const addDocument = () => {
    const newId =
      documents.length > 0 ? Math.max(...documents.map((d) => d.id)) + 1 : 1;
    const newIndex = documents.length;
    setDocuments([
      ...documents,
      { id: newId, text: "", originalIndex: newIndex },
    ]);
  };

  // Function to update a document
  const updateDocument = (id: number, text: string) => {
    setDocuments(
      documents.map((doc) => (doc.id === id ? { ...doc, text } : doc)),
    );
  };

  // Function to remove a document
  const removeDocument = (id: number) => {
    const newDocuments = documents.filter((doc) => doc.id !== id);
    // Update original indices
    newDocuments.forEach((doc, index) => {
      doc.originalIndex = index;
    });
    setDocuments(newDocuments);
  };

  // Function to rerank documents
  const rerankDocuments = async (values: FormValue) => {
    if (!values.model || !values.query) {
      alert(t("components.playground.rerank.selectModelAndQuery"));
      return;
    }

    const validDocuments = documents.filter((doc) => doc.text.trim() !== "");
    if (validDocuments.length === 0) {
      alert(t("components.playground.rerank.addOneDocument"));
      return;
    }

    setIsProcessing(true);
    try {
      const { data } = await rerankMutation({
        url: `/serve-proxy/${endpoint.metadata.workspace}/${endpoint.metadata.name}/v1/rerank`,
        method: "post",
        values: {
          model: values.model,
          query: values.query,
          documents: validDocuments.map((doc) => doc.text),
          top_n: 0, // Return all documents
        },
      });

      // Check if we have valid rerank results
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid response format from rerank API");
      }

      // Create a map of original documents for easy lookup
      const docMap = new Map(validDocuments.map((doc, idx) => [idx, doc]));

      // Process the reranked results
      const ranked: RankedDocument[] = data.results.map(
        (
          result: { index: number; relevance_score: number },
          newIndex: number,
        ) => {
          const originalDoc = docMap.get(result.index);
          if (!originalDoc) {
            throw new Error(`Invalid document index: ${result.index}`);
          }

          const oldIndex = originalDoc.originalIndex;
          const rankChange = oldIndex - newIndex;

          return {
            ...originalDoc,
            score: result.relevance_score,
            newRank: newIndex + 1,
            rankChange,
          };
        },
      );

      setRankedDocuments(ranked);

      setActiveTab("results");
    } catch (error) {
      console.error("Error reranking documents:", error);
      alert(t("components.playground.rerank.failedRerank"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to clear all
  const clearAll = () => {
    setDocuments([]);
    setRankedDocuments([]);
    form.setValue("query", "");
  };

  return (
    <Form {...form}>
      <div className="h-full overflow-auto">
        <div className="h-full flex-col">
          <div className="container h-full py-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {t("components.playground.rerank.title")}
              </h2>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => form.handleSubmit(rerankDocuments)()}
                >
                  {isProcessing
                    ? t("components.playground.rerank.processing")
                    : t("components.playground.rerank.rerank")}
                </Button>
                <Button type="button" variant="outline" onClick={clearAll}>
                  {t("buttons.clear")}
                </Button>
              </div>
            </div>

            <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_300px]">
              <div className="flex-col space-y-4 sm:flex md:order-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">
                      {t("components.playground.rerank.model")}
                    </Label>
                    <Controller
                      name="model"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          placeholder={t(
                            "components.playground.rerank.selectModel",
                          )}
                          triggerClassName="sm:w-[300px]"
                          popoverClassName="w-[300px]"
                          options={models}
                          {...field}
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="query">
                      {t("components.playground.rerank.query")}
                    </Label>
                    <Controller
                      name="query"
                      control={form.control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          placeholder={t(
                            "components.playground.rerank.enterSearchQuery",
                          )}
                          className="min-h-24"
                        />
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="md:order-1 space-y-6">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="documents">
                      {t("components.playground.rerank.documents")}
                    </TabsTrigger>
                    <TabsTrigger value="results">
                      {t("components.playground.rerank.results")}
                    </TabsTrigger>
                    <TabsTrigger value="json">
                      {t("components.playground.rerank.json")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="results" className="mt-4">
                    <ScrollArea className="h-[600px] rounded-md border">
                      <div className="p-4 space-y-4">
                        {rankedDocuments.length > 0 ? (
                          rankedDocuments.map((doc, index) => {
                            const changeDisplay = getRankChangeDisplay(
                              doc.rankChange,
                            );
                            return (
                              <div
                                key={doc.id}
                                className="p-2 border rounded-lg space-y-3 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-none w-6 h-6 flex items-center justify-center bg-primary text-primary-foreground rounded-full font-semibold">
                                      {doc.newRank}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span
                                        className={`flex items-center space-x-1 text-sm font-medium ${changeDisplay.className}`}
                                      >
                                        {changeDisplay.icon}
                                        <span>{changeDisplay.text}</span>
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        ({t("components.playground.rerank.was")}{" "}
                                        #{doc.originalIndex + 1})
                                      </span>
                                    </div>
                                  </div>
                                  <Badge variant="secondary">
                                    {t("components.playground.rerank.score")}:{" "}
                                    {doc.score.toFixed(4)}
                                  </Badge>
                                </div>
                                <p className="text-sm">{doc.text}</p>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground py-20">
                            {t("components.playground.rerank.noResults")}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4">
                    <ScrollArea className="h-[600px] rounded-md border">
                      <div className="p-4 space-y-4">
                        {documents.map((doc, index) => (
                          <div
                            key={doc.id}
                            className="flex items-start space-x-2"
                          >
                            <div className="flex-none w-8 h-8 flex items-center justify-center bg-muted text-muted-foreground rounded text-sm">
                              {index + 1}
                            </div>
                            <Textarea
                              value={doc.text}
                              onChange={(e) =>
                                updateDocument(doc.id, e.target.value)
                              }
                              placeholder={t(
                                "components.playground.rerank.enterDocumentText",
                              )}
                              className="flex-1 min-h-20"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDocument(doc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
                          <Plus className="h-4 w-4 mr-2" />{" "}
                          {t("components.playground.rerank.addDocument")}
                        </Button>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="json" className="mt-4">
                    <ScrollArea className="h-[600px] rounded-md border">
                      <pre className="p-4 text-xs bg-muted/30 text-foreground rounded">
                        {JSON.stringify(
                          {
                            query: form.getValues().query,
                            results: rankedDocuments.map((doc) => ({
                              rank: doc.newRank,
                              relevance_score: doc.score,
                              document: { text: doc.text },
                              rankChange: doc.rankChange,
                              originalRank: doc.originalIndex + 1,
                            })),
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}
