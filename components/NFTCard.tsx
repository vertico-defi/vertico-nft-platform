"use client";

import { useState } from "react";

type Trait = {
  trait_type: string;
  value: string;
};

type NFTCardProps = {
  name: string;
  description: string;
  imageSrc: string;
  imageFallbacks?: string[];
  traits: Trait[];
};

export default function NFTCard({
  name,
  description,
  imageSrc,
  imageFallbacks = [],
  traits,
}: NFTCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const imageOptions = [imageSrc, ...imageFallbacks];
  const currentImage = imageOptions[currentImageIndex];

  function handleImageError() {
    if (currentImageIndex < imageOptions.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl transition hover:border-amber-400/50 hover:bg-white/[0.06]">
      <div className="aspect-[3/4] overflow-hidden bg-zinc-900">
        <img
          src={currentImage}
          alt={name}
          onError={handleImageError}
          className="h-full w-full object-cover transition duration-500 hover:scale-105"
        />
      </div>

      <div className="p-5">
        <p className="mb-2 text-sm font-semibold text-amber-400">
          {description}
        </p>

        <h3 className="text-xl font-bold text-white">{name}</h3>

        <div className="mt-4 space-y-2">
          {traits.map((trait) => (
            <div
              key={`${trait.trait_type}-${trait.value}`}
              className="flex justify-between gap-4 rounded-lg bg-black/30 px-3 py-2 text-sm"
            >
              <span className="text-zinc-400">{trait.trait_type}</span>
              <span className="text-right font-medium text-zinc-100">
                {trait.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}