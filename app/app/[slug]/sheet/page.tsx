import { notFound } from "next/navigation";
import { SheetWorkspace } from "@/components/sheet/sheet-workspace";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";
import { allTools } from "@/lib/navigation";

export function generateStaticParams() {
  return [{ slug: "passport-photo" }];
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ joint?: string }>;
};

export default async function SheetPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const tool = allTools.find((item) => item.slug === slug);
  if (!tool) notFound();
  if (slug !== "passport-photo") return <ToolPlaceholder slug={slug} />;
  return <SheetWorkspace toolId={slug} openJointOnStart={query.joint === "1"} />;
}
