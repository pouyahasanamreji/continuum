import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function MarkdownBody({ text }: { text: string }) {
  return (
    <article className="prose dark:prose-invert max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-code:before:hidden prose-code:after:hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {text}
      </ReactMarkdown>
    </article>
  );
}
