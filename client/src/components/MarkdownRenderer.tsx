import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/**
 * Renders a note body.
 *
 * The input is the user's own text, but it round-trips through a GitHub repo
 * that could be edited from anywhere, so it is sanitised rather than trusted —
 * `dangerouslySetInnerHTML` over unsanitised Markdown is an XSS hole.
 *
 * Loaded lazily by `Markdown`: marked plus DOMPurify are only needed when a
 * note is previewed, which is not on the startup path.
 */
export default function MarkdownRenderer({ source }: { source: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(source, { async: false })),
    [source]
  );

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
