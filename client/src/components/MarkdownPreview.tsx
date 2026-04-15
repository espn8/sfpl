import ReactMarkdown from "react-markdown";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
};

export function MarkdownPreview({ content, className = "" }: MarkdownPreviewProps) {
  return (
    <div className={`markdown-preview ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 border-b border-(--color-border) pb-2 text-2xl font-bold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 border-b border-(--color-border) pb-1 text-xl font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="mb-1 mt-2 text-sm font-medium text-(--color-text-muted) first:mt-0">{children}</h6>
          ),
          p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-(--color-primary) underline decoration-1 underline-offset-2 hover:text-(--color-primary-hover)"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-3 ml-6 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-6 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-(--color-primary) bg-(--color-surface) py-2 pr-4 pl-4 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-(--color-surface) px-1.5 py-0.5 font-mono text-sm">
                  {children}
                </code>
              );
            }
            return (
              <code className="block overflow-x-auto rounded-lg bg-(--color-surface) p-4 font-mono text-sm">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg bg-(--color-surface) p-4 font-mono text-sm">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-6 border-(--color-border)" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse border border-(--color-border) text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-(--color-surface)">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-(--color-border) px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-(--color-border) px-3 py-2">{children}</td>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ""}
              className="my-3 max-w-full rounded-lg"
              loading="lazy"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
