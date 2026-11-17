import { notFound } from "next/navigation";
import { SheetWorkspace } from "@/components/sheet/sheet-workspace";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";
import { allTools } from "@/lib/navigation";
import { SHEET_TOOL_IDS } from "@/tools/sheet/presets";

export function generateStaticParams() {
  return SHEET_TOOL_IDS.map((slug) => ({ slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ joint?: string }>;
};

export default async function SheetPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const tool = allTools.find((item) => item.slug === slug);
  if (!tool) notFound();
  if (!SHEET_TOOL_IDS.includes(slug)) return <ToolPlaceholder slug={slug} />;
  return <SheetWorkspace toolId={slug} openJointOnStart={query.joint === "1"} />;
}
