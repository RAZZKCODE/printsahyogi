import { notFound } from "next/navigation";
import { allTools } from "@/lib/navigation";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";

export function generateStaticParams() {
  const uploadToolIds = new Set(["passport-photo"]);
  return allTools.filter(({ slug }) => !uploadToolIds.has(slug)).map(({ slug }) => ({ slug }));
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = allTools.find((item) => item.slug === params.slug);
  if (!tool) notFound();
  return <ToolPlaceholder slug={tool.slug} />;
}
