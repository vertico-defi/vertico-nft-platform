"use client";

import { useEffect, useState } from "react";
import MintClient from "@/components/MintClient";

export default function MintPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
              Mint
            </p>
            <h1 className="mt-3 text-5xl font-bold">Loading Mint Page...</h1>
            <p className="mt-5 text-zinc-400">
              Preparing wallet connection.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return <MintClient />;
}