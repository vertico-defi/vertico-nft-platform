export default function MarketplacePolicy() {
  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-950/30 p-5">
      <p className="font-semibold text-red-200">Prohibited content policy</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-red-100/90">
        <li>No minors or age-ambiguous performers.</li>
        <li>No CSAM or simulated CSAM.</li>
        <li>No non-consensual sexual content.</li>
        <li>No stolen content.</li>
        <li>No deepfakes or impersonation without verified consent.</li>
        <li>
          No sexual violence, coercion, exploitation, trafficking, bestiality,
          or illegal content.
        </li>
        <li>Creator must own or control all rights.</li>
        <li>Creator must confirm all depicted persons are 18+.</li>
      </ul>
      <p className="mt-4 text-xs leading-5 text-red-100/70">
        Vertico does not collect or store government IDs or passport photos in
        this MVP. Future identity and age checks should use a third-party
        verification provider.
      </p>
    </div>
  );
}
