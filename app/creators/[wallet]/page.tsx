import AgeGate from "@/components/AgeGate";
import CreatorProfileClient from "@/components/CreatorProfileClient";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;

  return (
    <>
      <AgeGate />
      <CreatorProfileClient wallet={wallet} />
    </>
  );
}
