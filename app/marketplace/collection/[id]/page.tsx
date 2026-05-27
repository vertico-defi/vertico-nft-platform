import AgeGate from "@/components/AgeGate";
import MarketplaceCollectionDetailClient from "@/components/MarketplaceCollectionDetailClient";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <AgeGate />
      <MarketplaceCollectionDetailClient collectionId={id} />
    </>
  );
}
