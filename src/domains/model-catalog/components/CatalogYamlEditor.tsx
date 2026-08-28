import yamlLanguage from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import {
  type ChangeEvent,
  createElement,
  type ReactNode,
  type UIEvent,
  useMemo,
  useRef,
} from "react";
import { cn } from "@/foundation/lib/utils";
import "./CatalogYamlEditor.css";

const lowlight = createLowlight({ yaml: yamlLanguage });
type HighlightNode = ReturnType<typeof lowlight.highlight>["children"][number];

function renderHighlightedNode(node: HighlightNode, key: string): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type !== "element") return null;

  const className = Array.isArray(node.properties.className)
    ? node.properties.className.join(" ")
    : undefined;
  return createElement(
    node.tagName,
    { className, key },
    node.children.map((child, index) =>
      renderHighlightedNode(child, `${key}-${index}`),
    ),
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

export function CatalogYamlEditor({
  value,
  onChange,
  ariaLabel,
  className,
}: Props) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const highlighted = useMemo(() => {
    const tree = lowlight.highlight("yaml", value || "\n");
    return tree.children.map((node, index) =>
      renderHighlightedNode(node, String(index)),
    );
  }, [value]);

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div
      className={cn(
        "catalog-yaml-editor relative h-[28rem] overflow-hidden rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] transition-colors hover:border-[var(--nt-stroke-neutral-trans-4)] focus-within:border-[var(--nt-stroke-outstanding-base)] focus-within:[box-shadow:var(--nt-outline-active-focus)]",
        className,
      )}
    >
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-3 font-mono text-xs leading-5 text-[var(--nt-text-neutral-primary)]"
      >
        <code>{highlighted}</code>
        {"\n"}
      </pre>
      <textarea
        data-testid="catalog-spec-yaml"
        aria-label={ariaLabel}
        className="absolute inset-0 size-full resize-none overflow-auto whitespace-pre border-0 bg-transparent p-3 font-mono text-xs leading-5 text-transparent caret-[var(--nt-text-neutral-primary)] outline-none [text-shadow:none] selection:bg-[var(--nt-fill-outstanding-light)]"
        style={{ WebkitTextFillColor: "transparent" }}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        onScroll={syncScroll}
        spellCheck={false}
      />
    </div>
  );
}
