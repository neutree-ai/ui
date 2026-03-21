import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentItem } from "@/domains/endpoint/hooks/use-document-list";

type DocumentListEditorProps = {
  documents: DocumentItem[];
  onUpdate: (id: number, text: string) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
  placeholder?: string;
  addButtonLabel?: string;
  scrollAreaClassName?: string;
  /** "id" shows doc.id, "position" shows array index + 1 */
  indexMode?: "id" | "position";
};

export function DocumentListEditor({
  documents,
  onUpdate,
  onRemove,
  onAdd,
  placeholder,
  addButtonLabel,
  scrollAreaClassName = "h-[400px]",
  indexMode = "position",
}: DocumentListEditorProps) {
  return (
    <ScrollArea className={`${scrollAreaClassName} rounded-md border`}>
      <div className="p-4 space-y-4">
        {documents.map((doc, index) => (
          <div key={doc.id} className="flex items-start space-x-2">
            <div className="flex-none w-8 h-8 flex items-center justify-center bg-muted text-muted-foreground rounded text-sm">
              {indexMode === "id" ? doc.id : index + 1}
            </div>
            <Textarea
              value={doc.text}
              onChange={(e) => onUpdate(doc.id, e.target.value)}
              placeholder={placeholder}
              className="flex-1 min-h-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(doc.id)}
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
          onClick={onAdd}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {addButtonLabel}
        </Button>
      </div>
    </ScrollArea>
  );
}
