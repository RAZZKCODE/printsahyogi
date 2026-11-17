export type PanPortal = "NSDL" | "UTIITSL";
export type PanKind = "photo" | "signature";
export type PanSpec = { width: number; height: number; maxKb: number; label: string };

/**
 * Portal requirements. NSDL values match the Protean (NSDL) e-Gov upload rules.
 * Edit here if a portal changes its limits.
 */
export const PAN_SPECS: Record<PanPortal, Record<PanKind, PanSpec>> = {
  NSDL: {
    photo: { width: 197, height: 276, maxKb: 20, label: "Profile Photo" },
    signature: { width: 354, height: 157, maxKb: 10, label: "Signature" }
  },
  UTIITSL: {
    photo: { width: 213, height: 213, maxKb: 30, label: "Profile Photo" },
    signature: { width: 400, height: 200, maxKb: 30, label: "Signature" }
  }
};

export const PAN_PORTALS: PanPortal[] = ["NSDL", "UTIITSL"];
export const MAX_UPLOAD_MB = 15;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
