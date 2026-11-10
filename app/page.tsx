import type { Metadata } from "next";
import { FloatingActions } from "@/components/shared/floating-actions";
import { SaleBanner } from "@/components/shared/sale-banner";
import { LandingContent } from "@/components/landing/landing-content";
import { LandingHeader } from "@/components/landing/landing-header";

const faqData = [
  ["What is PrintSahyogi?", "PrintSahyogi is a collection of browser-based tools for cropping cards, preparing passport photos, arranging collages, and working with PDFs."],
  ["How do I crop an Aadhaar card?", "Open Aadhaar crop, add your file, adjust the crop if needed, then download or print the result."],
  ["How do I crop an Ayushman card?", "Choose Ayushman crop, select your card image, and follow the on-screen steps to prepare a print-ready copy."],
  ["How do I crop a PDF?", "Open PDF Image Extractor, choose a PDF from your device, select the page or image you need, and save the result."],
  ["How do I create passport photos?", "Open Passport Photo Maker, add a portrait, choose the needed size, and create a printable photo sheet."],
  ["How do I print e-Aadhaar double-sided or on a PVC card?", "Use the Aadhaar A4 double-side glossy option to arrange both sides for printing. For PVC cards, use the Aadhaar printout tool and follow your printer’s card-printing instructions."]
];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "Free Card Crop, Passport Photo & Print Tools | PrintSahyogi",
  description: "Crop Aadhaar, Ayushman, PAN and other cards, create passport photos, compress images, make collages, and extract PDF images. Files stay in your browser.",
  keywords: ["Aadhaar crop", "card crop tool", "passport photo maker", "Ayushman card crop", "PAN card crop", "PDF image extractor", "image compressor", "photo collage"],
  ...(siteUrl ? { metadataBase: new URL(siteUrl), alternates: { canonical: "/" } } : {}),
  openGraph: {
    type: "website",
    siteName: "PrintSahyogi",
    title: "Card cropping and print tools in one place | PrintSahyogi",
    description: "Private browser tools for cards, photos, collages, and PDFs."
  },
  twitter: {
    card: "summary_large_image",
    title: "PrintSahyogi — Card crop and print tools",
    description: "Crop cards, make passport photos, and prepare files for printing."
  }
};

export default function HomePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer }
    }))
  };

  return <>
    <SaleBanner />
    <LandingHeader />
    <LandingContent />
    <FloatingActions />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
  </>;
}

