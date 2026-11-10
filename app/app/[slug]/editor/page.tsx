import { notFound } from "next/navigation";
import { PhotoEditorModal } from "@/components/editor/photo-editor-modal";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";
import { allTools } from "@/lib/navigation";

export function generateStaticParams() {
  return [{ slug: "passport-photo" }];
}

export default function EditorEntryPage({ params, searchParams }: { params: { slug: string }; searchParams?: { fileIndex?: string; returnToJoint?: string; returnToSheet?: string } }) {
  const tool = allTools.find(({ slug }) => slug === params.slug);
  if (!tool) notFound();
  if (params.slug !== "passport-photo") return <ToolPlaceholder slug={params.slug} />;
  const fileIndex = Math.max(0, Number.parseInt(searchParams?.fileIndex ?? "0", 10) || 0);
  return <PhotoEditorModal toolId={params.slug} fileIndex={fileIndex} returnToJoint={searchParams?.returnToJoint === "1"} returnToSheet={searchParams?.returnToSheet === "1"} />;
}
