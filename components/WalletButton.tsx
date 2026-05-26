"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        disabled
        className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-300 opacity-70"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
    </div>
  );
}