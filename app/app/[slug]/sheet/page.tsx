import { notFound } from "next/navigation";
import { SheetWorkspace } from "@/components/sheet/sheet-workspace";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";
import { allTools } from "@/lib/navigation";

export function generateStaticParams() {
  return [{ slug: "passport-photo" }];
}

export default function SheetPage({ params, searchParams }: { params: { slug: string }; searchParams?: { joint?: string } }) {
  const tool = allTools.find(({ slug }) => slug === params.slug);
  if (!tool) notFound();
  if (params.slug !== "passport-photo") return <ToolPlaceholder slug={params.slug} />;
  return <SheetWorkspace toolId={params.slug} openJointOnStart={searchParams?.joint === "1"} />;
}
