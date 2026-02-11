// Multi-source comps aggregator - uses Supabase Edge Function for reliable fetching

export interface Comp {
  title: string;
  price: number;
  date: string;
  condition?: string;
  url: string;
  imageUrl?: string;
  source: 'ebay' | 'cycletrader' | 'craigslist' | 'rvtrader';
  location?: string;
  mileage?: number;
}

export interface MultiSourceResult {
  comps: Comp[];
  sources: {
    ebay: number;
    cycletrader: number;
    craigslist: number;
    rvtrader: number;
  };
  lastUpdated: string;
  fromCache: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ========== Main Aggregator via Supabase Edge Function ==========
export async function searchAllSources(query: string): Promise<MultiSourceResult> {
  console.log('Fetching comps via Supabase for:', query);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-comps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Fetch comps failed: ${response.status}`);
    }

    const data = await response.json();

    console.log(`Found: eBay=${data.sources?.ebay || 0}, CycleTrader=${data.sources?.cycletrader || 0}, Craigslist=${data.sources?.craigslist || 0}`);

    return {
      comps: data.comps || [],
      sources: data.sources || { ebay: 0, cycletrader: 0, craigslist: 0, rvtrader: 0 },
      lastUpdated: new Date().toLocaleTimeString(),
      fromCache: false,
    };
  } catch (error) {
    console.error('Supabase fetch-comps error:', error);
    return {
      comps: [],
      sources: { ebay: 0, cycletrader: 0, craigslist: 0, rvtrader: 0 },
      lastUpdated: new Date().toLocaleTimeString(),
      fromCache: false,
    };
  }
}

// Search with caching - v3 never caches empty results
const CACHE_KEY = 'comps-v3';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for fresher data

interface CacheEntry {
  query: string;
  result: MultiSourceResult;
  timestamp: number;
}

export async function searchCompsWithCache(query: string, forceRefresh: boolean = false): Promise<MultiSourceResult> {
  const cacheKey = query.toLowerCase().trim();

  // Check localStorage cache (unless force refresh)
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}-${cacheKey}`);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        // Only use cache if it has results AND is not expired
        if (entry.result.comps.length > 0 && Date.now() - entry.timestamp < CACHE_DURATION) {
          console.log('Using cached comps for:', query, '- count:', entry.result.comps.length);
          return { ...entry.result, fromCache: true };
        }
      }
    } catch (e) {
      // Cache miss or parse error - fetch fresh
    }
  }

  // Fetch fresh
  console.log('Fetching fresh comps for:', query);
  const result = await searchAllSources(query);

  // Only cache if we got results (never cache empty)
  if (result.comps.length > 0) {
    try {
      const entry: CacheEntry = {
        query: cacheKey,
        result,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${CACHE_KEY}-${cacheKey}`, JSON.stringify(entry));
      console.log('Cached', result.comps.length, 'comps for:', query);
    } catch (e) {
      console.warn('Failed to cache comps:', e);
    }
  } else {
    console.log('Not caching empty result for:', query);
  }

  return result;
}

// Clear all comps cache
export function clearCompsCache(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY));
  keys.forEach(k => localStorage.removeItem(k));
  console.log('Cleared', keys.length, 'cached comp entries');
}
