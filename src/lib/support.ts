/**
 * Support contact details — change them here and every page updates.
 * WHATSAPP_NUMBER must be digits only, with the country code (91 for India) in front.
 */
export const SUPPORT_EMAIL = "razzdatasolution@gmail.com";
export const SUPPORT_WHATSAPP_DISPLAY = "925861048";
export const SUPPORT_WHATSAPP_NUMBER = "91925861048";
export const SUPPORT_WHATSAPP = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;

export function whatsappLink(message: string) {
  return `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function emailLink(subject: string, body = "") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
