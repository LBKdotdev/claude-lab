export interface EbayComp {
  title: string;
  price: number;
  soldDate: string;
  condition?: string;
  url: string;
  imageUrl?: string;
  source?: 'ebay' | 'cycletrader' | 'craigslist' | 'rvtrader';
}

export interface CompsResult {
  comps: EbayComp[];
  lastUpdated: string;
  fromCache: boolean;
}

interface CachedComps {
  query: string;
  comps: EbayComp[];
  timestamp: number;
}

const DB_NAME = 'bid-buddy-comps';
const DB_VERSION = 1;
const STORE_NAME = 'comps';
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

let db: IDBDatabase | null = null;

async function initCompsDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'query' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function saveToCache(query: string, comps: EbayComp[]): Promise<void> {
  const database = await initCompsDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data: CachedComps = {
      query: query.toLowerCase(),
      comps,
      timestamp: Date.now(),
    };

    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getFromCache(query: string): Promise<CachedComps | null> {
  const database = await initCompsDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(query.toLowerCase());

    request.onsuccess = () => {
      const data = request.result as CachedComps | undefined;
      if (data && Date.now() - data.timestamp < CACHE_DURATION) {
        resolve(data);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// Parse eBay HTML response to extract sold listings
function parseEbayHtml(html: string): EbayComp[] {
  const comps: EbayComp[] = [];

  // Match individual listing items
  const itemRegex = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const items = html.match(itemRegex) || [];

  for (const item of items) {
    try {
      // Skip sponsored/promo items
      if (item.includes('SPONSORED') || item.includes('s-item__pl-on-bottom')) {
        continue;
      }

      // Extract title
      const titleMatch = item.match(/<span[^>]*role="heading"[^>]*>([^<]+)<\/span>/i) ||
                         item.match(/<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
                         item.match(/class="s-item__title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);

      if (!titleMatch) continue;
      const title = decodeHtmlEntities(titleMatch[1].trim());

      // Skip placeholder items
      if (title.toLowerCase().includes('shop on ebay') || title === 'New Listing') {
        continue;
      }

      // Extract price
      const priceMatch = item.match(/class="s-item__price"[^>]*>[\s\S]*?\$([0-9,]+\.?\d*)/i) ||
                         item.match(/\$([0-9,]+\.?\d*)/);

      if (!priceMatch) continue;
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));

      if (isNaN(price) || price <= 0) continue;

      // Extract URL
      const urlMatch = item.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/i);
      const url = urlMatch ? urlMatch[1].split('?')[0] : '';

      // Extract image
      const imageMatch = item.match(/src="(https:\/\/i\.ebayimg\.com\/[^"]+)"/i);
      const imageUrl = imageMatch ? imageMatch[1] : undefined;

      // Extract sold date
      const dateMatch = item.match(/class="s-item__ended-date[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                        item.match(/class="s-item__endedDate[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                        item.match(/Sold\s+([A-Za-z]+\s+\d+)/i);
      const soldDate = dateMatch ? dateMatch[1].trim() : 'Recently';

      // Extract condition
      const conditionMatch = item.match(/class="SECONDARY_INFO"[^>]*>([^<]+)<\/span>/i) ||
                             item.match(/class="s-item__subtitle"[^>]*>([^<]+)<\/span>/i);
      const condition = conditionMatch ? conditionMatch[1].trim() : 'Used';

      comps.push({
        title,
        price,
        soldDate,
        condition,
        url,
        imageUrl,
      });

    } catch (e) {
      // Skip items that fail to parse
      console.warn('Failed to parse item:', e);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueComps = comps.filter(comp => {
    if (!comp.url || seen.has(comp.url)) return false;
    seen.add(comp.url);
    return true;
  });

  return uniqueComps.slice(0, 20);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Fetch via CORS proxy (fallback for development)
async function fetchViaProxy(query: string): Promise<EbayComp[]> {
  const encodedQuery = encodeURIComponent(query);
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

  // Try multiple CORS proxies in case one is down
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(ebayUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(ebayUrl)}`,
  ];

  let lastError: Error | null = null;

  for (const proxyUrl of proxies) {
    try {
      console.log('Trying proxy:', proxyUrl.split('?')[0]);

      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }

      const html = await response.text();

      // Verify we got eBay content
      if (!html.includes('ebay') && !html.includes('s-item')) {
        throw new Error('Invalid response from proxy');
      }

      const comps = parseEbayHtml(html);

      if (comps.length > 0) {
        console.log(`Found ${comps.length} comps via proxy`);
        return comps;
      }
    } catch (e) {
      console.warn('Proxy failed:', e);
      lastError = e as Error;
    }
  }

  throw lastError || new Error('All proxies failed');
}

// Try Supabase function first, fall back to CORS proxy
async function fetchComps(query: string): Promise<EbayComp[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Try Supabase Edge Function first
  if (supabaseUrl && supabaseKey) {
    try {
      const apiUrl = `${supabaseUrl}/functions/v1/fetch-ebay-comps?q=${encodeURIComponent(query)}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.comps && data.comps.length > 0) {
          console.log('Got comps from Supabase function');
          return data.comps;
        }
      }
    } catch (e) {
      console.warn('Supabase function failed, trying fallback:', e);
    }
  }

  // Fallback to CORS proxy
  console.log('Using CORS proxy fallback');
  return fetchViaProxy(query);
}

export async function searchEbayComps(query: string): Promise<CompsResult> {
  // Check cache first
  const cached = await getFromCache(query);
  if (cached) {
    return {
      comps: cached.comps,
      lastUpdated: formatTimestamp(cached.timestamp),
      fromCache: true,
    };
  }

  // Fetch fresh data
  const comps = await fetchComps(query);

  if (comps.length === 0) {
    return {
      comps: [],
      lastUpdated: formatTimestamp(Date.now()),
      fromCache: false,
    };
  }

  // Save to cache
  await saveToCache(query, comps);

  return {
    comps,
    lastUpdated: formatTimestamp(Date.now()),
    fromCache: false,
  };
}

export async function getCachedComps(query: string): Promise<CompsResult | null> {
  const cached = await getFromCache(query);
  if (!cached) return null;

  return {
    comps: cached.comps,
    lastUpdated: formatTimestamp(cached.timestamp),
    fromCache: true,
  };
}
