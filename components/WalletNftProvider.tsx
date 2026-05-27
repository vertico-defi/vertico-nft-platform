"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type MintAttribute = {
  trait_type: string;
  value: string;
};

export type WalletNftEntry = {
  id: string;
  timestamp: string;
  network: "devnet";
  collection: "pages" | "courtiers" | "royals";
  name: string;
  description: string;
  attributes: MintAttribute[];
  mintAddress: string;
  recipient: string;
  paymentSignature?: string;
  paymentAmountSol?: number;
  treasuryWallet?: string;
  metadataUri: string;
  imageUri: string;
  explorer: string;
  paymentExplorer?: string;
  collectionExplorer: string;
  source?: "supabase" | "onchain";
};

export type WalletNftStats = {
  total: number;
  pages: number;
  courtiers: number;
  royals: number;
};

export type NativeListingState = {
  listingId: string;
  saleStatus: "listed" | "cancelled" | "hidden" | "sold";
  status: string;
  priceSol: number | null;
};

export type WalletNftState = {
  walletAddress: string | null;
  nfts: WalletNftEntry[];
  stats: WalletNftStats | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  listingStateByMint: Record<string, NativeListingState>;
  listingStateLoading: boolean;
  listingStateError: string | null;
  refresh: () => Promise<void>;
  refreshListingState: () => Promise<void>;
  setListingStateForMint: (
    mintAddress: string,
    listing: NativeListingState | null
  ) => void;
};

type CachedNftData = {
  walletAddress: string;
  nfts: WalletNftEntry[];
  stats: WalletNftStats | null;
  lastLoadedAt: number;
};

type CachedListingData = {
  walletAddress: string;
  listingStateByMint: Record<string, NativeListingState>;
  lastLoadedAt: number;
};

type MyNftsResponse = {
  success: boolean;
  nfts: WalletNftEntry[];
  totals: WalletNftStats;
  error?: string;
};

type NativeStateResponse = {
  success: boolean;
  listingsByMint?: Record<string, NativeListingState>;
  error?: string;
};

const CACHE_MAX_AGE_MS = 60 * 1000;
const MIN_BACKGROUND_REFETCH_MS = 30 * 1000;
const NETWORK = "devnet";

const WalletNftContext = createContext<WalletNftState | null>(null);

const memoryNftCache = new Map<string, CachedNftData>();
const memoryListingCache = new Map<string, CachedListingData>();
const pendingNftRequests = new Map<string, Promise<CachedNftData>>();
const pendingListingRequests = new Map<string, Promise<CachedListingData>>();

function nftCacheKey(walletAddress: string) {
  return `vertico:nfts:${NETWORK}:${walletAddress}`;
}

function listingCacheKey(walletAddress: string) {
  return `vertico:native-listings:${NETWORK}:${walletAddress}`;
}

function readSessionJson<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}

function writeSessionJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage can be unavailable in private contexts.
  }
}

function getCachedNfts(walletAddress: string) {
  const key = nftCacheKey(walletAddress);
  const memory = memoryNftCache.get(key);

  if (memory) return memory;

  const session = readSessionJson<CachedNftData>(key);

  if (session?.walletAddress === walletAddress) {
    memoryNftCache.set(key, session);
    return session;
  }

  return null;
}

function getCachedListings(walletAddress: string) {
  const key = listingCacheKey(walletAddress);
  const memory = memoryListingCache.get(key);

  if (memory) return memory;

  const session = readSessionJson<CachedListingData>(key);

  if (session?.walletAddress === walletAddress) {
    memoryListingCache.set(key, session);
    return session;
  }

  return null;
}

async function fetchWalletNfts({
  walletAddress,
  signal,
}: {
  walletAddress: string;
  signal?: AbortSignal;
}) {
  const key = nftCacheKey(walletAddress);
  const pending = pendingNftRequests.get(key);

  if (pending) return pending;

  const request = fetch(`/api/my-nfts?wallet=${walletAddress}`, {
    cache: "no-store",
    signal,
  })
    .then(async (response) => {
      const data: MyNftsResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load wallet NFTs.");
      }

      const cached: CachedNftData = {
        walletAddress,
        nfts: data.nfts || [],
        stats: data.totals || null,
        lastLoadedAt: Date.now(),
      };

      memoryNftCache.set(key, cached);
      writeSessionJson(key, cached);

      return cached;
    })
    .finally(() => {
      pendingNftRequests.delete(key);
    });

  pendingNftRequests.set(key, request);
  return request;
}

async function fetchNativeListingState({
  walletAddress,
  signal,
}: {
  walletAddress: string;
  signal?: AbortSignal;
}) {
  const key = listingCacheKey(walletAddress);
  const pending = pendingListingRequests.get(key);

  if (pending) return pending;

  const request = fetch(
    `/api/marketplace/listings/native-state?wallet=${walletAddress}`,
    {
      cache: "no-store",
      signal,
    }
  )
    .then(async (response) => {
      const data: NativeStateResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load marketplace listing state.");
      }

      const cached: CachedListingData = {
        walletAddress,
        listingStateByMint: data.listingsByMint || {},
        lastLoadedAt: Date.now(),
      };

      memoryListingCache.set(key, cached);
      writeSessionJson(key, cached);

      return cached;
    })
    .finally(() => {
      pendingListingRequests.delete(key);
    });

  pendingListingRequests.set(key, request);
  return request;
}

export function WalletNftProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const [nfts, setNfts] = useState<WalletNftEntry[]>([]);
  const [stats, setStats] = useState<WalletNftStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [listingStateByMint, setListingStateByMint] = useState<
    Record<string, NativeListingState>
  >({});
  const [listingStateLoading, setListingStateLoading] = useState(false);
  const [listingStateError, setListingStateError] = useState<string | null>(null);
  const walletRef = useRef(walletAddress);
  const nftAbortRef = useRef<AbortController | null>(null);
  const listingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    walletRef.current = walletAddress;
  }, [walletAddress]);

  const applyCachedNfts = useCallback((cached: CachedNftData) => {
    setNfts(cached.nfts);
    setStats(cached.stats);
    setLastLoadedAt(cached.lastLoadedAt);
  }, []);

  const applyCachedListings = useCallback((cached: CachedListingData) => {
    setListingStateByMint(cached.listingStateByMint);
  }, []);

  const refresh = useCallback(
    async ({ force = true }: { force?: boolean } = {}) => {
      if (!walletAddress) return;

      const cached = getCachedNfts(walletAddress);
      const hasVisibleData = cached || nfts.length > 0;
      const age = cached ? Date.now() - cached.lastLoadedAt : Infinity;

      if (!force && cached && age < MIN_BACKGROUND_REFETCH_MS) {
        applyCachedNfts(cached);
        return;
      }

      nftAbortRef.current?.abort();
      const controller = new AbortController();
      nftAbortRef.current = controller;

      setError(null);
      setLoading(!hasVisibleData);
      setRefreshing(Boolean(hasVisibleData));

      try {
        const result = await fetchWalletNfts({
          walletAddress,
          signal: controller.signal,
        });

        if (walletRef.current !== walletAddress) return;

        applyCachedNfts(result);
      } catch (refreshError) {
        if (controller.signal.aborted) return;
        if (walletRef.current !== walletAddress) return;

        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Could not load wallet NFTs."
        );
      } finally {
        if (walletRef.current === walletAddress) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyCachedNfts, nfts.length, walletAddress]
  );

  const refreshListingState = useCallback(
    async ({ force = true }: { force?: boolean } = {}) => {
      if (!walletAddress) return;

      const cached = getCachedListings(walletAddress);
      const age = cached ? Date.now() - cached.lastLoadedAt : Infinity;

      if (!force && cached && age < MIN_BACKGROUND_REFETCH_MS) {
        applyCachedListings(cached);
        return;
      }

      listingAbortRef.current?.abort();
      const controller = new AbortController();
      listingAbortRef.current = controller;

      setListingStateLoading(true);
      setListingStateError(null);

      try {
        const result = await fetchNativeListingState({
          walletAddress,
          signal: controller.signal,
        });

        if (walletRef.current !== walletAddress) return;

        applyCachedListings(result);
      } catch (listingError) {
        if (controller.signal.aborted) return;
        if (walletRef.current !== walletAddress) return;

        setListingStateError(
          listingError instanceof Error
            ? listingError.message
            : "Could not load marketplace listing state."
        );
      } finally {
        if (walletRef.current === walletAddress) {
          setListingStateLoading(false);
        }
      }
    },
    [applyCachedListings, walletAddress]
  );

  useEffect(() => {
    if (!walletAddress) {
      nftAbortRef.current?.abort();
      listingAbortRef.current?.abort();
      // Wallet adapter state is external; clear wallet-scoped cache when it disconnects.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNfts([]);
      setStats(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setLastLoadedAt(null);
      setListingStateByMint({});
      setListingStateLoading(false);
      setListingStateError(null);
      return;
    }

    const cached = getCachedNfts(walletAddress);
    const listingCache = getCachedListings(walletAddress);

    if (cached) {
      applyCachedNfts(cached);
    } else {
      setNfts([]);
      setStats(null);
      setLastLoadedAt(null);
    }

    if (listingCache) {
      applyCachedListings(listingCache);
    } else {
      setListingStateByMint({});
    }

    const nftAge = cached ? Date.now() - cached.lastLoadedAt : Infinity;
    const listingAge = listingCache
      ? Date.now() - listingCache.lastLoadedAt
      : Infinity;

    if (!cached || nftAge > CACHE_MAX_AGE_MS) {
      void refresh({ force: false });
    }

    if (!listingCache || listingAge > CACHE_MAX_AGE_MS) {
      void refreshListingState({ force: false });
    }
  }, [
    applyCachedListings,
    applyCachedNfts,
    refresh,
    refreshListingState,
    walletAddress,
  ]);

  useEffect(() => {
    function handleRefreshEvent() {
      void refresh({ force: true });
      void refreshListingState({ force: true });
    }

    window.addEventListener("vertico:nfts:refresh", handleRefreshEvent);

    return () => {
      window.removeEventListener("vertico:nfts:refresh", handleRefreshEvent);
    };
  }, [refresh, refreshListingState]);

  const setListingStateForMint = useCallback(
    (mintAddress: string, listing: NativeListingState | null) => {
      if (!walletAddress) return;

      setListingStateByMint((current) => {
        const next = { ...current };

        if (listing) {
          next[mintAddress] = listing;
        } else {
          delete next[mintAddress];
        }

        const cached: CachedListingData = {
          walletAddress,
          listingStateByMint: next,
          lastLoadedAt: Date.now(),
        };

        const key = listingCacheKey(walletAddress);
        memoryListingCache.set(key, cached);
        writeSessionJson(key, cached);

        return next;
      });
    },
    [walletAddress]
  );

  const value = useMemo<WalletNftState>(
    () => ({
      walletAddress,
      nfts,
      stats,
      loading,
      refreshing,
      error,
      lastLoadedAt,
      listingStateByMint,
      listingStateLoading,
      listingStateError,
      refresh: () => refresh({ force: true }),
      refreshListingState: () => refreshListingState({ force: true }),
      setListingStateForMint,
    }),
    [
      error,
      lastLoadedAt,
      listingStateByMint,
      listingStateError,
      listingStateLoading,
      loading,
      nfts,
      refresh,
      refreshListingState,
      refreshing,
      setListingStateForMint,
      stats,
      walletAddress,
    ]
  );

  return (
    <WalletNftContext.Provider value={value}>
      {children}
    </WalletNftContext.Provider>
  );
}

export function useWalletNfts() {
  const context = useContext(WalletNftContext);

  if (!context) {
    throw new Error("useWalletNfts must be used inside WalletNftProvider.");
  }

  return context;
}
