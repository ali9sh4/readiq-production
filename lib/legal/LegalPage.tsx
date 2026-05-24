import fs from "node:fs/promises";
import path from "node:path";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type LegalPageProps = {
  file: "terms-and-conditions" | "privacy-policy" | "cookie-policy";
};

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl sm:text-4xl font-extrabold text-sky-900 mt-2 mb-6 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl sm:text-2xl font-bold text-sky-900 mt-10 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-sky-800 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-800 leading-relaxed my-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 my-4 space-y-2 text-gray-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 my-4 space-y-2 text-gray-800">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-sky-700 underline hover:text-sky-900 break-words"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-8 border-gray-200" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-sky-200 pl-4 italic text-gray-700 my-4">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-200 text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-200 px-3 py-2 align-top text-gray-800">
      {children}
    </td>
  ),
  code: ({ children }) => (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  ),
};

export default async function LegalPage({ file }: LegalPageProps) {
  const filePath = path.join(process.cwd(), "content", "legal", `${file}.md`);
  const markdown = await fs.readFile(filePath, "utf8");

  return (
    <div dir="ltr" className="bg-white min-h-screen">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
