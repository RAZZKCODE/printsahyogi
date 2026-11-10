import { notFound } from "next/navigation";
import { PhotoEditorModal } from "@/components/editor/photo-editor-modal";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";
import { allTools } from "@/lib/navigation";

export function generateStaticParams() {
  return [{ slug: "passport-photo" }];
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    fileIndex?: string;
    returnToJoint?: string;
    returnToSheet?: string;
  }>;
};

export default async function EditorEntryPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const tool = allTools.find((item) => item.slug === slug);
  if (!tool) notFound();
  if (slug !== "passport-photo") return <ToolPlaceholder slug={slug} />;

  const fileIndex = Math.max(0, Number.parseInt(query.fileIndex ?? "0", 10) || 0);
  return (
    <PhotoEditorModal
      toolId={slug}
      fileIndex={fileIndex}
      returnToJoint={query.returnToJoint === "1"}
      returnToSheet={query.returnToSheet === "1"}
    />
  );
}
