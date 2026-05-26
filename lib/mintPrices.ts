export type CollectionType = "pages" | "courtiers" | "royals";

export const MINT_PRICES_SOL: Record<CollectionType, number> = {
  pages: 0.05,
  courtiers: 0.1,
  royals: 0.2,
};

export function getMintPriceSol(collection: CollectionType) {
  return MINT_PRICES_SOL[collection];
}