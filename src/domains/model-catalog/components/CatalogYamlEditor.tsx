import yamlLanguage from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import {
  type ChangeEvent,
  createElement,
  type ReactNode,
  useMemo,
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
  const highlighted = useMemo(() => {
    // A textarea keeps a last, empty line when the text ends in a newline; the
    // highlight layer drops that trailing break. Left alone, the layer is 20px
    // shorter than the textarea's own content box, which hands the textarea
    // back its private scrolling — and the caret back out of step with the
    // text. Give the layer the line the textarea is counting.
    const source = value ? (value.endsWith("\n") ? `${value}\n` : value) : "\n";
    const tree = lowlight.highlight("yaml", source);
    return tree.children.map((node, index) =>
      renderHighlightedNode(node, String(index)),
    );
  }, [value]);

  return (
    <div
      className={cn(
        "catalog-yaml-editor relative h-[28rem] min-h-[10rem] resize-y overflow-hidden rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] [box-shadow:var(--nt-effect-button-shadow-push-button-ordinary)] transition-colors hover:border-[var(--nt-stroke-neutral-trans-4)] focus-within:border-[var(--nt-stroke-outstanding-base)] focus-within:[box-shadow:var(--nt-outline-active-focus)]",
        className,
      )}
    >
      {/* One scroller carries both layers, and that is the whole point of this
          structure. Syncing a textarea's own scrolling onto an overlay by hand
          cannot work: the two elements do not have the same box, because only
          the textarea's scrollbars take space out of it — a horizontal one
          shortens its viewport by ~15px, a vertical one narrows it by the same,
          and their content extents end up 20-35px apart on a catalog with a
          long description line. The overlay then stops scrolling while the
          textarea keeps going, and the caret is drawn a line or two away from
          the text it belongs to. Scrolling the shared parent moves the glyphs
          and the caret together, so they cannot drift apart. */}
      <div className="absolute inset-0 overflow-auto">
        {/* Sized by the highlight layer, so the textarea is always exactly as
            large as the text it has to cover. `min-h-full` keeps the caret
            reachable in the empty space under a short document. */}
        <div className="relative min-h-full w-max min-w-full">
          <pre
            aria-hidden="true"
            className="pointer-events-none whitespace-pre p-3 font-mono text-xs leading-5 text-[var(--nt-text-neutral-primary)]"
          >
            <code>{highlighted}</code>
          </pre>
          <textarea
            data-testid="catalog-spec-yaml"
            aria-label={ariaLabel}
            wrap="off"
            className="absolute inset-0 overflow-hidden whitespace-pre border-0 bg-transparent p-3 font-mono text-xs leading-5 text-transparent caret-[var(--nt-text-neutral-primary)] outline-none [text-shadow:none] selection:bg-[var(--nt-fill-outstanding-light)]"
            style={{ WebkitTextFillColor: "transparent" }}
            value={value}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              // The textarea never scrolls itself — its box is the size of its
              // text — but the browser can still leave a small internal offset
              // behind after a keystroke that lengthened the line the caret is
              // on, and that offset would show up as the same drift. Reset it.
              event.currentTarget.scrollTop = 0;
              event.currentTarget.scrollLeft = 0;
              onChange(event.target.value);
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
