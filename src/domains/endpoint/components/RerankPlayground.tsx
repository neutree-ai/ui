import { useCustomMutation } from "@refinedev/core";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DocumentListEditor } from "@/domains/endpoint/components/DocumentListEditor";
import { PlaygroundLayout } from "@/domains/endpoint/components/PlaygroundLayout";
import { useDocumentList } from "@/domains/endpoint/hooks/use-document-list";
import { usePlaygroundModels } from "@/domains/endpoint/hooks/use-playground-models";
import {
  processRerankResults,
  type RankedDocument,
} from "@/domains/endpoint/lib/rerank-helpers";
import type { Endpoint } from "@/domains/endpoint/types";

const INITIAL_DOCUMENTS = [
  { id: 1, text: "Paris is the capital and largest city of France." },
  {
    id: 2,
    text: "The Eiffel Tower is located in Paris and is one of the most famous landmarks.",
  },
  {
    id: 3,
    text: "London is the capital city of England and the United Kingdom.",
  },
  { id: 4, text: "The weather in Paris is generally mild with warm summers." },
  { id: 5, text: "Berlin is the capital and largest city of Germany." },
];

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

type RerankPlaygroundProps = {
  endpoint: Endpoint;
};

export default function RerankPlayground({ endpoint }: RerankPlaygroundProps) {
  const { t } = useTranslation();
  const {
    documents,
    addDocument,
    updateDocument,
    removeDocument,
    clearDocuments,
  } = useDocumentList(INITIAL_DOCUMENTS);
  const [rankedDocuments, setRankedDocuments] = useState<RankedDocument[]>([]);
  const [activeTab, setActiveTab] = useState("documents");
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<FormValue>({
    mode: "all",
    defaultValues: { model: "", query: "What is the capital of France?" },
  });
  const { models } = usePlaygroundModels(endpoint, form);
  const { mutateAsync: rerankMutation } = useCustomMutation();

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
          top_n: 0,
        },
      });

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid response format from rerank API");
      }

      const docsWithIndex = validDocuments.map((doc, i) => ({
        ...doc,
        originalIndex: i,
      }));
      setRankedDocuments(processRerankResults(data.results, docsWithIndex));
      setActiveTab("results");
    } catch (error) {
      console.error("Error reranking documents:", error);
      alert(t("components.playground.rerank.failedRerank"));
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    clearDocuments();
    setRankedDocuments([]);
    form.setValue("query", "");
  };

  return (
    <Form {...form}>
      <PlaygroundLayout
        title={t("components.playground.rerank.title")}
        actions={
          <>
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
          </>
        }
        sidebar={
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
                    placeholder={t("components.playground.rerank.selectModel")}
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
        }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                  rankedDocuments.map((doc) => {
                    const changeDisplay = getRankChangeDisplay(doc.rankChange);
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
                                ({t("components.playground.rerank.was")} #
                                {doc.originalIndex + 1})
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
            <DocumentListEditor
              documents={documents}
              onUpdate={updateDocument}
              onRemove={removeDocument}
              onAdd={addDocument}
              scrollAreaClassName="h-[600px]"
              placeholder={t("components.playground.rerank.enterDocumentText")}
              addButtonLabel={t("components.playground.rerank.addDocument")}
            />
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
      </PlaygroundLayout>
    </Form>
  );
}
