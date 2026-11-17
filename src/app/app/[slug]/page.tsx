import { notFound } from "next/navigation";
import { allTools } from "@/lib/navigation";
import { ToolPlaceholder } from "@/components/shared/tool-placeholder";
import { CardCropTool } from "@/components/card-crop/card-crop-tool";
import { CARD_CROP_CONFIGS } from "@/tools/card-crop/config";
import { PanCardResizer } from "@/components/tools/pan-card-resizer";
import { SupportPage } from "@/components/help/support-page";
import { SuggestFeaturePage } from "@/components/help/suggest-page";

export function generateStaticParams() {
  const uploadToolIds = new Set(["passport-photo", "postcard-photo", "collage", "card-dashboard"]);
  return allTools.filter(({ slug }) => !uploadToolIds.has(slug)).map(({ slug }) => ({ slug }));
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = allTools.find((item) => item.slug === slug);
  if (!tool) notFound();
  if (slug === "aadhaar-crop" || slug === "aadhaar-crop-a4-double-side-glossy") {
    return <CardCropTool config={CARD_CROP_CONFIGS[slug]} />;
  }
  if (slug === "pan-card-resizer") return <PanCardResizer />;
  if (slug === "suggest-a-feature") return <SuggestFeaturePage />;
  if (slug === "support") return <SupportPage />;
  return <ToolPlaceholder slug={tool.slug} />;
}
