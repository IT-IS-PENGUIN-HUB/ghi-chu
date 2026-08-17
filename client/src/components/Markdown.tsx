import { lazy, Suspense } from "react";

/**
 * Lazy wrapper around the Markdown renderer.
 *
 * Keeps marked and DOMPurify (~50 KB) out of the initial bundle: previewing a
 * note is a deliberate action, while the checklist has to be on screen the
 * instant the app opens.
 */
const Renderer = lazy(() => import("./MarkdownRenderer"));

export function Markdown({ source }: { source: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap text-sm">{source}</p>}>
      <Renderer source={source} />
    </Suspense>
  );
}
