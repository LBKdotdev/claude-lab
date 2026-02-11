import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Comp {
  title: string;
  price: number;
  date: string;
  url: string;
  imageUrl?: string;
  source: 'ebay' | 'cycletrader' | 'craigslist' | 'rvtrader' | 'facebook';
  location?: string;
}

// Facebook Marketplace - public search (limited but worth trying)
async function fetchFacebookMarketplace(query: string): Promise<Comp[]> {
  // Facebook Marketplace search URL for vehicles category
  const encodedQuery = encodeURIComponent(query);
  // Using the public GraphQL search endpoint approach
  const url = `https://www.facebook.com/marketplace/la/search?query=${encodedQuery}&exact=false`;

  try {
    console.log('Fetching Facebook Marketplace:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.log('Facebook failed:', response.status);
      return [];
    }

    const html = await response.text();
    console.log('Facebook HTML length:', html.length);

    const comps: Comp[] = [];

    // Try to extract listing data from the page
    // Facebook embeds JSON data in script tags
    const jsonMatches = html.matchAll(/"marketplace_listing_title":"([^"]+)"[^}]*"listing_price":\{"formatted_amount":"([^"]+)"/g);

    for (const match of jsonMatches) {
      const title = match[1];
      const priceStr = match[2].replace(/[^0-9.]/g, '');
      const price = parseFloat(priceStr);

      if (title && price > 0) {
        comps.push({
          title: decodeHtml(title),
          price,
          date: 'Listed',
          url: 'https://www.facebook.com/marketplace',
          source: 'facebook',
          location: 'Facebook MP',
        });
      }
    }

    // Alternative pattern for newer Facebook layout
    if (comps.length === 0) {
      const pricePattern = /\$([0-9,]+)[\s\S]*?<span[^>]*>([^<]{10,80})</gi;
      let match;
      while ((match = pricePattern.exec(html)) !== null && comps.length < 10) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        const title = match[2].trim();
        if (price > 500 && price < 100000 && title.length > 10) {
          comps.push({
            title: decodeHtml(title),
            price,
            date: 'Listed',
            url: 'https://www.facebook.com/marketplace',
            source: 'facebook',
            location: 'Facebook MP',
          });
        }
      }
    }

    console.log('Facebook comps found:', comps.length);
    return comps.slice(0, 10);
  } catch (e) {
    console.error('Facebook fetch error:', e);
    return [];
  }
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

// eBay Finding API - official API for sold listings
const EBAY_APP_ID = Deno.env.get('EBAY_APP_ID') || '';

async function fetchEbaySold(query: string): Promise<Comp[]> {
  // Try official Finding API first if we have credentials
  if (EBAY_APP_ID) {
    try {
      const apiComps = await fetchEbayFindingAPI(query);
      if (apiComps.length > 0) {
        console.log('eBay Finding API returned', apiComps.length, 'results');
        return apiComps;
      }
    } catch (e) {
      console.error('eBay Finding API failed, falling back to scraping:', e);
    }
  }

  // Fallback to HTML scraping
  return fetchEbayHtmlScrape(query);
}

// Official eBay Finding API
async function fetchEbayFindingAPI(query: string): Promise<Comp[]> {
  const url = 'https://svcs.ebay.com/services/search/FindingService/v1';
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': query,
    'categoryId': '6024', // Motorcycles category
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '30',
  });

  console.log('Calling eBay Finding API for:', query);
  const response = await fetch(`${url}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`eBay API error: ${response.status}`);
  }

  const data = await response.json();
  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

  console.log('eBay API raw items:', items.length);

  return items.map((item: any) => ({
    title: item.title?.[0] || 'eBay Listing',
    price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
    date: item.listingInfo?.[0]?.endTime?.[0] ?
      new Date(item.listingInfo[0].endTime[0]).toLocaleDateString() : 'Sold',
    url: item.viewItemURL?.[0] || '',
    imageUrl: item.galleryURL?.[0],
    source: 'ebay' as const,
    location: item.location?.[0],
  })).filter((c: Comp) => c.price > 0).slice(0, 25);
}

// Fallback HTML scraping
async function fetchEbayHtmlScrape(query: string): Promise<Comp[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=120&rt=nc`;

  try {
    console.log('Fetching eBay HTML:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
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
        if (title.toLowerCase().includes('shop on ebay')) continue;

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

// Craigslist - search multiple categories for better coverage
async function fetchCraigslist(query: string, city: string): Promise<Comp[]> {
  const cityNames: Record<string, string> = {
    'losangeles': 'Los Angeles',
    'orangecounty': 'Orange County',
    'inlandempire': 'Inland Empire',
    'sandiego': 'San Diego',
    'phoenix': 'Phoenix',
    'lasvegas': 'Las Vegas',
    'sfbay': 'SF Bay Area',
    'sacramento': 'Sacramento',
  };

  const encodedQuery = encodeURIComponent(query);
  // Search multiple categories: mca (motorcycles), sss (all for sale), mcy (motorcycles/scooters)
  const categories = ['mca', 'sss', 'mcy'];
  const allComps: Comp[] = [];

  for (const category of categories) {
    const url = `https://${city}.craigslist.org/search/${category}?query=${encodedQuery}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });

      if (!response.ok) continue;
      const html = await response.text();

      // New Craigslist layout uses JSON in script tag
      const jsonMatch = html.match(/<script[^>]*id="ld_searchpage_results"[^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (data.itemListElement) {
            for (const item of data.itemListElement.slice(0, 15)) {
              const offer = item.item?.offers;
              if (offer?.price) {
                allComps.push({
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
          // JSON parse failed, try HTML
        }
      }

      // Fallback HTML parsing
      if (allComps.length === 0) {
        const listingRegex = /<li[^>]*class="[^"]*cl-static-search-result[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        const listings = html.match(listingRegex) || [];

        for (const listing of listings.slice(0, 15)) {
          const priceMatch = listing.match(/\$([0-9,]+)/);
          const titleMatch = listing.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i);
          const urlMatch = listing.match(/href="(https?:\/\/[^"]+)"/i);

          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            if (price > 0) {
              allComps.push({
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
      console.error(`Craigslist ${city}/${category} fetch error:`, e);
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return allComps.filter(c => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
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
        for (const v of vehicles.slice(0, 20)) {
          if (v.price) {
            comps.push({
              title: v.title || `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(),
              price: typeof v.price === 'number' ? v.price : parseFloat(String(v.price).replace(/[^0-9.]/g, '')),
              date: 'Listed',
              url: v.url || v.detailUrl || `https://www.cycletrader.com`,
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
    console.error('CycleTrader fetch error:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Fetch from all sources in parallel - expanded regions for better coverage
    const [ebayResults, cycleResults, facebookResults, ...craigslistResults] = await Promise.allSettled([
      fetchEbaySold(query),
      fetchCycleTrader(query),
      fetchFacebookMarketplace(query),
      // SoCal
      fetchCraigslist(query, 'losangeles'),
      fetchCraigslist(query, 'orangecounty'),
      fetchCraigslist(query, 'inlandempire'),
      fetchCraigslist(query, 'sandiego'),
      // Extended regions - buyers travel for deals
      fetchCraigslist(query, 'phoenix'),
      fetchCraigslist(query, 'lasvegas'),
      fetchCraigslist(query, 'sfbay'),
      fetchCraigslist(query, 'sacramento'),
    ]);

    const ebayComps = ebayResults.status === 'fulfilled' ? ebayResults.value : [];
    const cycleComps = cycleResults.status === 'fulfilled' ? cycleResults.value : [];
    const facebookComps = facebookResults.status === 'fulfilled' ? facebookResults.value : [];
    const craigslistComps = craigslistResults
      .filter((r): r is PromiseFulfilledResult<Comp[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    const allComps = [...ebayComps, ...cycleComps, ...facebookComps, ...craigslistComps]
      .sort((a, b) => a.price - b.price);

    console.log(`Found: eBay=${ebayComps.length}, CycleTrader=${cycleComps.length}, Facebook=${facebookComps.length}, Craigslist=${craigslistComps.length}`);

    return new Response(
      JSON.stringify({
        comps: allComps,
        sources: {
          ebay: ebayComps.length,
          cycletrader: cycleComps.length,
          craigslist: craigslistComps.length,
          facebook: facebookComps.length,
        },
        lastUpdated: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
