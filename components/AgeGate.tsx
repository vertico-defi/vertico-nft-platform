"use client";

import { useEffect, useState } from "react";

export default function AgeGate() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("vertico_age_verified");
    setIsVerified(stored === "true");
  }, []);

  function confirmAge() {
    localStorage.setItem("vertico_age_verified", "true");
    setIsVerified(true);
  }

  function denyAge() {
    window.location.href = "https://www.google.com";
  }

  if (isVerified === null || isVerified === true) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-2xl">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-zinc-950/90 p-8 text-center shadow-2xl">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-amber-400">
          Age Restricted
        </p>

        <h1 className="mb-4 text-3xl font-bold text-white">
          Enter Vertico
        </h1>

        <p className="mb-6 text-sm leading-6 text-zinc-300">
          This website may contain mature digital collectibles and age-restricted
          content. By entering, you confirm that you are at least 18 years old
          or the age of majority in your jurisdiction.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={confirmAge}
            className="w-full rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black transition hover:bg-amber-400"
          >
            I am 18 or older
          </button>

          <button
            onClick={denyAge}
            className="w-full rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Leave
          </button>
        </div>

        <p className="mt-5 text-xs text-zinc-500">
          Access is restricted to adults only.
        </p>
      </div>
    </div>
  );
}