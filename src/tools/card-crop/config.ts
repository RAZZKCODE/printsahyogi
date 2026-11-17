export type CardCropConfig = {
  slug: string;
  name: string;
  shortName: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number;
  sides: 1 | 2;
  frontLabel: string;
  backLabel: string;
  duplexGlossy?: boolean;
};

const idCard = (slug: string, name: string, shortName = name): CardCropConfig => ({
  slug, name, shortName, widthMm: 85.6, heightMm: 54,
  aspectRatio: 85.6 / 54, sides: 2, frontLabel: "Front", backLabel: "Back"
});

export const CARD_CROP_CONFIGS: Record<string, CardCropConfig> = {
  "aadhaar-crop": idCard("aadhaar-crop", "Aadhaar Card", "Aadhaar"),
  "aadhaar-crop-a4-double-side-glossy": { ...idCard("aadhaar-crop-a4-double-side-glossy", "Aadhaar Card", "Aadhaar"), duplexGlossy: true },
  "ayushman-crop": idCard("ayushman-crop", "Ayushman Card", "Ayushman"),
  "abha-card-crop": idCard("abha-card-crop", "ABHA Health ID Card", "ABHA"),
  "e-shram-card-crop": idCard("e-shram-card-crop", "e-Shram Card", "e-Shram"),
  "id-card-crop": idCard("id-card-crop", "ID Card"),
  "mahasarathi-card": idCard("mahasarathi-card", "MahaSarathi Card", "MahaSarathi"),
  "pan-card-crop": idCard("pan-card-crop", "PAN Card", "PAN"),
  "pan-card-resizer": idCard("pan-card-resizer", "PAN Card", "PAN"),
  "punjab-health-card": idCard("punjab-health-card", "Punjab Health Card", "Punjab Health"),
  "ration-card-crop": idCard("ration-card-crop", "Ration Card"),
  "voter-card-crop": idCard("voter-card-crop", "Voter Card"),
  "multi-card-print": idCard("multi-card-print", "Card", "Multi Card"),
  "aadhaar-printout": idCard("aadhaar-printout", "Aadhaar Card", "Aadhaar")
};

export const CARD_CROP_SLUGS = Object.keys(CARD_CROP_CONFIGS);
