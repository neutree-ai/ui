import { useState } from "react";

export type DocumentItem = {
  id: number;
  text: string;
};

export function useDocumentList(initialDocuments: DocumentItem[] = []) {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);

  const addDocument = () => {
    const newId =
      documents.length > 0 ? Math.max(...documents.map((d) => d.id)) + 1 : 1;
    setDocuments([...documents, { id: newId, text: "" }]);
  };

  const updateDocument = (id: number, text: string) => {
    setDocuments(
      documents.map((doc) => (doc.id === id ? { ...doc, text } : doc)),
    );
  };

  const removeDocument = (id: number) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  const clearDocuments = () => {
    setDocuments([]);
  };

  return {
    documents,
    setDocuments,
    addDocument,
    updateDocument,
    removeDocument,
    clearDocuments,
  };
}
