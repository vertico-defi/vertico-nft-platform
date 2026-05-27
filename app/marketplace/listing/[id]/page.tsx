import AgeGate from "@/components/AgeGate";
import MarketplaceListingDetailClient from "@/components/MarketplaceListingDetailClient";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <AgeGate />
      <MarketplaceListingDetailClient listingId={id} />
    </>
  );
}
