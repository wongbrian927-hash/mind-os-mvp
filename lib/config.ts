/** Canonical public origin. Change here if the Vercel project name changes. */
export const PUBLIC_HOST = "mind-os-mvp.vercel.app";
export const PUBLIC_URL = `https://${PUBLIC_HOST}`;
export function shareCardUrl(tierCode: string) {
  return `${PUBLIC_URL}/?source=share_card&tier=${tierCode}`;
}
