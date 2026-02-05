import { Comp, CompsSummary, CompsResult } from '../types/comps';

const SOURCES = [
  'Facebook Marketplace',
  'CycleTrader',
  'Craigslist',
  'OfferUp',
  'eBay Motors',
  'Dealer Site',
];

const CA_CITIES = [
  { name: 'Anaheim', state: 'CA', distance: 5 },
  { name: 'Santa Ana', state: 'CA', distance: 8 },
  { name: 'Irvine', state: 'CA', distance: 12 },
  { name: 'Orange', state: 'CA', distance: 7 },
  { name: 'Garden Grove', state: 'CA', distance: 6 },
  { name: 'Costa Mesa', state: 'CA', distance: 15 },
  { name: 'Huntington Beach', state: 'CA', distance: 18 },
  { name: 'Newport Beach', state: 'CA', distance: 20 },
  { name: 'Long Beach', state: 'CA', distance: 25 },
  { name: 'Los Angeles', state: 'CA', distance: 35 },
  { name: 'Riverside', state: 'CA', distance: 40 },
  { name: 'San Bernardino', state: 'CA', distance: 45 },
  { name: 'San Diego', state: 'CA', distance: 85 },
  { name: 'Temecula', state: 'CA', distance: 55 },
  { name: 'Murrieta', state: 'CA', distance: 52 },
];

function generateMockComps(
  targetYear: number,
  make: string,
  model: string,
  targetPrice: number,
  targetMileage: number | null,
  count: number = 5
): Comp[] {
  const comps: Comp[] = [];
  const usedSources = new Set<string>();

  for (let i = 0; i < count; i++) {
    const yearVariance = Math.floor(Math.random() * 5) - 2;
    const year = targetYear + yearVariance;
    const matchScore = Math.max(50, 100 - Math.abs(yearVariance) * 10 - Math.random() * 20);

    const priceVariance = (Math.random() - 0.5) * 0.3;
    const price = Math.round(targetPrice * (1 + priceVariance));

    const mileageBase = targetMileage || 15000 + Math.random() * 30000;
    const mileageVariance = (Math.random() - 0.5) * 30000;
    const mileage = Math.max(1000, Math.round(mileageBase + mileageVariance));

    const mileageDiff = targetMileage ? Math.abs(mileage - targetMileage) : 0;
    const mileage_quality: 'strong' | 'weak' | 'unknown' = targetMileage
      ? mileageDiff <= 15000
        ? 'strong'
        : 'weak'
      : 'unknown';

    let source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    while (usedSources.has(source) && usedSources.size < SOURCES.length) {
      source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    }
    usedSources.add(source);

    const location = CA_CITIES[Math.floor(Math.random() * CA_CITIES.length)];

    const status: 'active' | 'sold' = Math.random() > 0.4 ? 'active' : 'sold';

    const daysAgo = Math.floor(Math.random() * 90);
    const listingDate = new Date();
    listingDate.setDate(listingDate.getDate() - daysAgo);

    const sourceUrl = generateSourceUrl(source, make, model, year);

    comps.push({
      status,
      price,
      year,
      make,
      model,
      trim: Math.random() > 0.5 ? null : ['Base', 'Sport', 'Limited', 'SE', 'LE'][Math.floor(Math.random() * 5)],
      mileage,
      mileage_quality,
      location_city: location.name,
      location_state: location.state,
      distance_miles: location.distance + Math.floor(Math.random() * 10),
      source_name: source,
      source_url: sourceUrl,
      listing_date: listingDate.toISOString().split('T')[0],
      match_score: Math.round(matchScore),
    });
  }

  return comps.sort((a, b) => b.match_score - a.match_score);
}

function generateSourceUrl(source: string, make: string, model: string, year: number): string {
  const slug = `${year}-${make}-${model}`.toLowerCase().replace(/\s+/g, '-');
  const id = Math.random().toString(36).substring(2, 15);

  switch (source) {
    case 'Facebook Marketplace':
      return `https://www.facebook.com/marketplace/item/${id}`;
    case 'CycleTrader':
      return `https://www.cycletrader.com/listing/${slug}-${id}`;
    case 'Craigslist':
      return `https://orangecounty.craigslist.org/mcy/d/${slug}/${id}.html`;
    case 'OfferUp':
      return `https://offerup.com/item/detail/${id}`;
    case 'eBay Motors':
      return `https://www.ebay.com/itm/${id}`;
    case 'Dealer Site':
      return `https://dealer-example.com/inventory/${slug}`;
    default:
      return `https://example.com/listing/${id}`;
  }
}

export function generateComps(
  year: number,
  make: string,
  model: string,
  price: number,
  mileage: number | null
): CompsResult {
  const comps = generateMockComps(year, make, model, price, mileage, 5);

  const prices = comps.map(c => c.price);
  const sortedPrices = [...prices].sort((a, b) => a - b);

  const summary: CompsSummary = {
    count_active: comps.filter(c => c.status === 'active').length,
    count_sold: comps.filter(c => c.status === 'sold').length,
    average_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    median_price: sortedPrices[Math.floor(sortedPrices.length / 2)],
    low_price: Math.min(...prices),
    high_price: Math.max(...prices),
    last_updated: new Date().toISOString(),
  };

  return { comps, summary };
}

export function parseCompsCSV(csvText: string): Comp[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const comps: Comp[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || null;
    });

    if (!row.source_name || !row.source_url || !row.price) {
      continue;
    }

    comps.push({
      status: row.status === 'sold' ? 'sold' : 'active',
      price: parseFloat(row.price) || 0,
      year: row.year ? parseInt(row.year) : null,
      make: row.make || '',
      model: row.model || '',
      trim: row.trim || null,
      mileage: row.mileage ? parseInt(row.mileage) : null,
      mileage_quality: row.mileage_quality || 'unknown',
      location_city: row.location_city || null,
      location_state: row.location_state || null,
      distance_miles: row.distance_miles ? parseFloat(row.distance_miles) : null,
      source_name: row.source_name,
      source_url: row.source_url,
      listing_date: row.listing_date || null,
      match_score: row.match_score ? parseFloat(row.match_score) : 50,
    });
  }

  return comps;
}

export function calculateCompsSummary(comps: Comp[]): CompsSummary {
  if (comps.length === 0) {
    return {
      count_active: 0,
      count_sold: 0,
      average_price: 0,
      median_price: 0,
      low_price: 0,
      high_price: 0,
      last_updated: new Date().toISOString(),
    };
  }

  const prices = comps.map(c => c.price);
  const sortedPrices = [...prices].sort((a, b) => a - b);

  return {
    count_active: comps.filter(c => c.status === 'active').length,
    count_sold: comps.filter(c => c.status === 'sold').length,
    average_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    median_price: sortedPrices[Math.floor(sortedPrices.length / 2)],
    low_price: Math.min(...prices),
    high_price: Math.max(...prices),
    last_updated: new Date().toISOString(),
  };
}
