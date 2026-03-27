import ReactMarkdown from "react-markdown";

export default function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm">
      <ReactMarkdown
        components={{
          a: (p) => (
            <a
              {...p}
              target="_blank"
              className="text-primary underline hover:opacity-80"
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
