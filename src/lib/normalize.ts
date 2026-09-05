/**
 * Name normalization for duplicate detection. Pure and dependency-free so it
 * can be unit-tested and used on both client and server.
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[.,'’"`\-_]/g, " ") // superficial punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, "");
}
