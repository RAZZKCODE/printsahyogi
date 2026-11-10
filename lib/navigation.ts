import {
  BookOpenText, BriefcaseBusiness, Camera, Captions, CreditCard, Crown,
  FileImage, GalleryVerticalEnd, HeartPulse, Image, IdCard, Landmark,
  LayoutDashboard, MessageSquarePlus, PanelsTopLeft, Printer, ScanLine,
  Store, UsersRound, WalletCards, type LucideIcon
} from "lucide-react";

export type ToolItem = {
  title: string;
  slug: string;
  icon: LucideIcon;
  subtitle?: string;
};

export type ToolGroup = { title: string; items: ToolItem[] };

export const toolGroups: ToolGroup[] = [
  {
    title: "PHOTO TOOLS",
    items: [
      { title: "Collage", slug: "collage", icon: GalleryVerticalEnd },
      { title: "Compress Image", slug: "compress-image", icon: Image },
      { title: "Passport photo", slug: "passport-photo", icon: Camera },
      { title: "Postcard photo", slug: "postcard-photo", icon: Captions },
      { title: "Pan Card Resizer", slug: "pan-card-resizer", icon: CreditCard }
    ]
  },
  {
    title: "CARD CROP & PRINT",
    items: [
      { title: "Aadhaar crop", slug: "aadhaar-crop", icon: ScanLine },
      { title: "Aadhaar crop (A4 Double-side-glossy)", slug: "aadhaar-crop-a4-double-side-glossy", icon: ScanLine, subtitle: "A4 · Double-side glossy" },
      { title: "Ayushman crop", slug: "ayushman-crop", icon: HeartPulse },
      { title: "Abha card crop", slug: "abha-card-crop", icon: IdCard },
      { title: "E Shram card crop", slug: "e-shram-card-crop", icon: BriefcaseBusiness },
      { title: "ID Card Crop", slug: "id-card-crop", icon: IdCard },
      { title: "MahaSarathi Card", slug: "mahasarathi-card", icon: Landmark },
      { title: "Pan card crop", slug: "pan-card-crop", icon: CreditCard },
      { title: "Punjab health Card", slug: "punjab-health-card", icon: HeartPulse },
      { title: "Multi Card Print", slug: "multi-card-print", icon: WalletCards },
      { title: "Ration Card crop", slug: "ration-card-crop", icon: PanelsTopLeft },
      { title: "Voter card crop", slug: "voter-card-crop", icon: UsersRound }
    ]
  },
  {
    title: "PRINT & PDF",
    items: [
      { title: "Aadhaar (printout)", slug: "aadhaar-printout", icon: Printer },
      { title: "Crop PDF to Image", slug: "crop-pdf-to-image", icon: FileImage },
      { title: "PDF Image Extractor", slug: "pdf-image-extractor", icon: FileImage }
    ]
  },
  {
    title: "MORE",
    items: [
      { title: "Card Dashboard", slug: "card-dashboard", icon: LayoutDashboard },
      { title: "Plans", slug: "plans", icon: Crown },
      { title: "Shop", slug: "shop", icon: Store },
      { title: "Suggest a Feature", slug: "suggest-a-feature", icon: MessageSquarePlus },
      { title: "Support", slug: "support", icon: BookOpenText }
    ]
  }
];

export const allTools = toolGroups.flatMap((group) => group.items);
