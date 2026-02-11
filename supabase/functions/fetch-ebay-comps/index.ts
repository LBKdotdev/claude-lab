import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EbayComp {
  title: string;
  price: number;
  soldDate: string;
  condition: string;
  url: string;
  imageUrl: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing query parameter 'q'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build eBay sold listings URL
    // LH_Complete=1 = Completed listings
    // LH_Sold=1 = Sold listings only
    // _sop=13 = Sort by end date (recent first)
    const encodedQuery = encodeURIComponent(query);
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;

    console.log("Fetching:", ebayUrl);

    const response = await fetch(ebayUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`eBay request failed: ${response.status}`);
    }

    const html = await response.text();
    const comps = parseEbayResults(html);

    return new Response(
      JSON.stringify({
        comps,
        query,
        count: comps.length,
        source: "ebay_sold",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch comps" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseEbayResults(html: string): EbayComp[] {
  const comps: EbayComp[] = [];

  // Find all listing items using regex patterns
  // eBay uses s-item class for search results
  const itemPattern = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const items = html.match(itemPattern) || [];

  for (const item of items) {
    try {
      // Skip promotional items
      if (item.includes('s-item__pl-on-bottom') || item.includes('SPONSORED')) {
        continue;
      }

      // Extract title
      const titleMatch = item.match(/<span[^>]*role="heading"[^>]*>([^<]+)<\/span>/i) ||
                         item.match(/<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
                         item.match(/class="s-item__title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);

      if (!titleMatch) continue;
      const title = decodeHtmlEntities(titleMatch[1].trim());

      // Skip "Shop on eBay" placeholder items
      if (title.toLowerCase().includes('shop on ebay') || title === 'New Listing') {
        continue;
      }

      // Extract price - look for sold price specifically
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
      const imageUrl = imageMatch ? imageMatch[1] : null;

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
      console.error("Parse error for item:", e);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueComps = comps.filter(comp => {
    if (!comp.url || seen.has(comp.url)) return false;
    seen.add(comp.url);
    return true;
  });

  return uniqueComps.slice(0, 20); // Return top 20
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
