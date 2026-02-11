import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface Comp {
  title: string;
  price: number;
  date: string;
  url: string;
  imageUrl?: string;
  source: 'ebay' | 'cycletrader' | 'craigslist';
  location?: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));
}

// eBay sold listings via HTML scraping
async function fetchEbaySold(query: string): Promise<Comp[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=120&rt=nc`;

  try {
    console.log('Fetching eBay:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) return [];
    const html = await response.text();

    const comps: Comp[] = [];
    const itemRegex = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    const items = html.match(itemRegex) || [];

    for (const item of items) {
      try {
        if (item.includes('SPONSORED')) continue;

        const titleMatch = item.match(/<span[^>]*role="heading"[^>]*>([^<]+)<\/span>/i) ||
                           item.match(/class="s-item__title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
        if (!titleMatch) continue;
        const title = decodeHtml(titleMatch[1].trim());
        if (title.toLowerCase().includes('shop on ebay') || title === 'New Listing') continue;

        const priceMatch = item.match(/class="s-item__price"[^>]*>[\s\S]*?\$([0-9,]+\.?\d*)/i);
        if (!priceMatch) continue;
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (isNaN(price) || price <= 0) continue;

        const urlMatch = item.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/i);
        const imageMatch = item.match(/src="(https:\/\/i\.ebayimg\.com\/[^"]+)"/i);
        const dateMatch = item.match(/Sold\s+([A-Za-z]+\s+\d+)/i);

        comps.push({
          title,
          price,
          date: dateMatch ? dateMatch[1].trim() : 'Recently sold',
          url: urlMatch ? urlMatch[1].split('?')[0] : '',
          imageUrl: imageMatch ? imageMatch[1] : undefined,
          source: 'ebay',
        });
      } catch (e) {
        // Skip failed items
      }
    }

    const seen = new Set<string>();
    return comps.filter(c => {
      if (!c.url || seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    }).slice(0, 25);
  } catch (e) {
    console.error('eBay scrape error:', e);
    return [];
  }
}

// Craigslist search
async function fetchCraigslist(query: string, city: string): Promise<Comp[]> {
  const cityNames: Record<string, string> = {
    'losangeles': 'Los Angeles',
    'orangecounty': 'Orange County',
    'inlandempire': 'Inland Empire',
    'sandiego': 'San Diego',
    'phoenix': 'Phoenix',
    'lasvegas': 'Las Vegas',
  };

  const encodedQuery = encodeURIComponent(query);
  const url = `https://${city}.craigslist.org/search/mca?query=${encodedQuery}`;
  const comps: Comp[] = [];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return [];
    const html = await response.text();

    // New Craigslist layout uses JSON in script tag
    const jsonMatch = html.match(/<script[^>]*id="ld_searchpage_results"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.itemListElement) {
          for (const item of data.itemListElement.slice(0, 10)) {
            const offer = item.item?.offers;
            if (offer?.price) {
              comps.push({
                title: item.item?.name || 'Craigslist Listing',
                price: parseFloat(offer.price),
                date: 'Listed',
                url: item.item?.url || `https://${city}.craigslist.org`,
                imageUrl: item.item?.image?.[0],
                source: 'craigslist',
                location: cityNames[city] || city,
              });
            }
          }
        }
      } catch (e) {
        // JSON parse failed
      }
    }

    // Fallback HTML parsing
    if (comps.length === 0) {
      const listingRegex = /<li[^>]*class="[^"]*cl-static-search-result[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
      const listings = html.match(listingRegex) || [];

      for (const listing of listings.slice(0, 10)) {
        const priceMatch = listing.match(/\$([0-9,]+)/);
        const titleMatch = listing.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i);
        const urlMatch = listing.match(/href="(https?:\/\/[^"]+)"/i);

        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (price > 0) {
            comps.push({
              title: titleMatch ? decodeHtml(titleMatch[1].trim()) : 'Craigslist Listing',
              price,
              date: 'Listed',
              url: urlMatch ? urlMatch[1] : `https://${city}.craigslist.org`,
              source: 'craigslist',
              location: cityNames[city] || city,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error(`Craigslist ${city} error:`, e);
  }

  return comps;
}

// Cycle Trader
async function fetchCycleTrader(query: string): Promise<Comp[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.cycletrader.com/motorcycles-for-sale?keyword=${encodedQuery}&sort=price:asc`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return [];
    const html = await response.text();
    const comps: Comp[] = [];

    // Try JSON data first
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const vehicles = data?.search?.results || data?.listings || [];
        for (const v of vehicles.slice(0, 15)) {
          if (v.price) {
            comps.push({
              title: v.title || `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(),
              price: typeof v.price === 'number' ? v.price : parseFloat(String(v.price).replace(/[^0-9.]/g, '')),
              date: 'Listed',
              url: v.url || v.detailUrl || 'https://www.cycletrader.com',
              imageUrl: v.imageUrl || v.primaryImage,
              source: 'cycletrader',
              location: v.location || v.city,
            });
          }
        }
      } catch (e) {
        console.warn('CycleTrader JSON parse failed');
      }
    }

    return comps;
  } catch (e) {
    console.error('CycleTrader error:', e);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Fetching comps for:', query);

    // Fetch from all sources in parallel
    const [ebayResults, cycleResults, ...craigslistResults] = await Promise.allSettled([
      fetchEbaySold(query),
      fetchCycleTrader(query),
      fetchCraigslist(query, 'losangeles'),
      fetchCraigslist(query, 'sandiego'),
      fetchCraigslist(query, 'phoenix'),
      fetchCraigslist(query, 'lasvegas'),
    ]);

    const ebayComps = ebayResults.status === 'fulfilled' ? ebayResults.value : [];
    const cycleComps = cycleResults.status === 'fulfilled' ? cycleResults.value : [];
    const craigslistComps = craigslistResults
      .filter((r): r is PromiseFulfilledResult<Comp[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    const allComps = [...ebayComps, ...cycleComps, ...craigslistComps]
      .sort((a, b) => a.price - b.price);

    console.log(`Found: eBay=${ebayComps.length}, CycleTrader=${cycleComps.length}, Craigslist=${craigslistComps.length}`);

    return new Response(
      JSON.stringify({
        comps: allComps,
        sources: {
          ebay: ebayComps.length,
          cycletrader: cycleComps.length,
          craigslist: craigslistComps.length,
          rvtrader: 0,
        },
        lastUpdated: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
