import { Comp, CompsSummary, FilterDebugInfo } from '../types/comps';
import { KittyCompsSearchParams, KittyCompsSearchResult, KittyCompsExpansion } from '../types/kittyComps';

const EXPANDED_SOURCES = [
  'Autotrader',
  'Cars.com',
  'CarGurus',
  'Craigslist',
  'Facebook Marketplace',
  'CycleTrader',
  'OfferUp',
  'eBay Motors',
  'Carvana',
  'Vroom',
  'TrueCar',
  'CarMax',
];

const MOCK_LISTINGS: Array<Partial<Comp> & { seller_type?: 'dealer' | 'private' | 'unknown' }> = [
  { make: 'Honda', model: 'Civic', year: 2020, price: 18500, mileage: 32000, trim: 'LX', source_name: 'Autotrader', seller_type: 'dealer' },
  { make: 'Honda', model: 'Civic', year: 2019, price: 17200, mileage: 45000, trim: 'Sport', source_name: 'Cars.com', seller_type: 'private' },
  { make: 'Honda', model: 'Civic', year: 2021, price: 19800, mileage: 25000, trim: 'EX', source_name: 'CarGurus', seller_type: 'dealer' },
  { make: 'Honda', model: 'Civic', year: 2020, price: 18000, mileage: 38000, trim: 'LX', source_name: 'Craigslist', seller_type: 'private' },
  { make: 'Honda', model: 'Civic', year: 2018, price: 15500, mileage: 55000, trim: 'EX', source_name: 'Facebook Marketplace', seller_type: 'private' },
  { make: 'Honda', model: 'Civic', year: 2022, price: 21500, mileage: 18000, trim: 'Sport', source_name: 'Carvana', seller_type: 'dealer' },
  { make: 'Honda', model: 'Civic', year: 2019, price: 16800, mileage: 42000, trim: 'LX', source_name: 'OfferUp', seller_type: 'private' },
  { make: 'Honda', model: 'Civic', year: 2020, price: 19200, mileage: 28000, trim: 'EX', source_name: 'CarMax', seller_type: 'dealer' },
  { make: 'Honda', model: 'Accord', year: 2019, price: 22000, mileage: 42000, trim: 'Sport', source_name: 'Autotrader', seller_type: 'dealer' },
  { make: 'Honda', model: 'Accord', year: 2020, price: 24500, mileage: 30000, trim: 'EX-L', source_name: 'Cars.com', seller_type: 'dealer' },
  { make: 'Honda', model: 'Accord', year: 2018, price: 19500, mileage: 50000, trim: 'LX', source_name: 'CarGurus', seller_type: 'private' },
  { make: 'Toyota', model: 'Camry', year: 2020, price: 23000, mileage: 35000, trim: 'SE', source_name: 'Autotrader', seller_type: 'dealer' },
  { make: 'Toyota', model: 'Camry', year: 2019, price: 21500, mileage: 42000, trim: 'LE', source_name: 'Cars.com', seller_type: 'dealer' },
  { make: 'Toyota', model: 'Camry', year: 2021, price: 25500, mileage: 28000, trim: 'XSE', source_name: 'CarGurus', seller_type: 'dealer' },
  { make: 'Toyota', model: 'Corolla', year: 2020, price: 17500, mileage: 33000, trim: 'LE', source_name: 'Craigslist', seller_type: 'private' },
  { make: 'Ford', model: 'F-150', year: 2019, price: 32000, mileage: 48000, trim: 'XLT', source_name: 'Autotrader', seller_type: 'dealer' },
  { make: 'Ford', model: 'F-150', year: 2020, price: 35500, mileage: 35000, trim: 'Lariat', source_name: 'Cars.com', seller_type: 'dealer' },
  { make: 'Chevrolet', model: 'Silverado', year: 2019, price: 31000, mileage: 52000, trim: 'LT', source_name: 'CarGurus', seller_type: 'dealer' },
  { make: 'Harley-Davidson', model: 'Street Glide', year: 2018, price: 15500, mileage: 12000, source_name: 'CycleTrader', seller_type: 'dealer' },
  { make: 'Harley-Davidson', model: 'Street Glide', year: 2019, price: 17200, mileage: 9000, source_name: 'CycleTrader', seller_type: 'dealer' },
  { make: 'Harley-Davidson', model: 'Street Glide', year: 2020, price: 19800, mileage: 6000, source_name: 'Facebook Marketplace', seller_type: 'private' },
  { make: 'Harley-Davidson', model: 'Street Glide', year: 2019, price: 16500, mileage: 10500, source_name: 'eBay Motors', seller_type: 'private' },
  { make: 'Harley-Davidson', model: 'Street Glide', year: 2021, price: 21000, mileage: 4000, source_name: 'Autotrader', seller_type: 'dealer' },
  { make: 'Can-Am', model: 'Spyder RT', year: 2019, price: 13500, mileage: 8500, source_name: 'CycleTrader', seller_type: 'dealer' },
  { make: 'Can-Am', model: 'Spyder RT', year: 2020, price: 15200, mileage: 5200, source_name: 'CycleTrader', seller_type: 'dealer' },
  { make: 'Can-Am', model: 'Spyder RT', year: 2018, price: 11800, mileage: 12000, source_name: 'Facebook Marketplace', seller_type: 'private' },
  { make: 'Can-Am', model: 'Ryker', year: 2020, price: 8500, mileage: 3200, source_name: 'CycleTrader', seller_type: 'dealer' },
  { make: 'Can-Am', model: 'Ryker', year: 2019, price: 7200, mileage: 5800, source_name: 'Facebook Marketplace', seller_type: 'private' },
  { make: 'Can-Am', model: 'Ryker', year: 2021, price: 9800, mileage: 1800, source_name: 'Autotrader', seller_type: 'dealer' },
  { make: 'Can-Am', model: 'Ryker', year: 2018, price: 6500, mileage: 8200, source_name: 'OfferUp', seller_type: 'private' },
];

function generateSourceUrl(source: string, make: string, model: string, year: number): string {
  const slug = `${year}-${make}-${model}`.toLowerCase().replace(/\s+/g, '-');
  const id = Math.random().toString(36).substring(2, 15);

  const urlMap: Record<string, string> = {
    'Autotrader': `https://www.autotrader.com/cars-for-sale/vehicledetails.xhtml?listingId=${id}`,
    'Cars.com': `https://www.cars.com/vehicledetail/${id}`,
    'CarGurus': `https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?entitySelectingHelper.selectedEntity=${id}`,
    'Craigslist': `https://sandiego.craigslist.org/csd/cto/d/${slug}/${id}.html`,
    'Facebook Marketplace': `https://www.facebook.com/marketplace/item/${id}`,
    'CycleTrader': `https://www.cycletrader.com/listing/${slug}-${id}`,
    'OfferUp': `https://offerup.com/item/detail/${id}`,
    'eBay Motors': `https://www.ebay.com/itm/${id}`,
    'Carvana': `https://www.carvana.com/vehicle/${id}`,
    'Vroom': `https://www.vroom.com/inventory/${slug}`,
    'TrueCar': `https://www.truecar.com/used-cars-for-sale/listing/${id}`,
    'CarMax': `https://www.carmax.com/car/${id}`,
  };

  return urlMap[source] || `https://example.com/listing/${id}`;
}

function filterListings(
  listings: Array<Partial<Comp> & { seller_type?: 'dealer' | 'private' | 'unknown' }>,
  params: KittyCompsSearchParams,
  maxDistance: number
): { passed: Comp[]; rejected: Array<{ listing: any; reasons: string[] }> } {
  const passed: Comp[] = [];
  const rejected: Array<{ listing: any; reasons: string[] }> = [];

  const yearMin = params.year - 2;
  const yearMax = params.year + 2;
  const mileageMin = params.mileage ? params.mileage - 15000 : undefined;
  const mileageMax = params.mileage ? params.mileage + 15000 : undefined;

  for (const listing of listings) {
    const reasons: string[] = [];
    let passes = true;

    if (listing.make?.toLowerCase() !== params.make.toLowerCase()) {
      reasons.push(`Make mismatch: "${listing.make}" !== "${params.make}"`);
      passes = false;
    } else {
      reasons.push(`Make match: "${listing.make}"`);
    }

    if (listing.model?.toLowerCase() !== params.model.toLowerCase()) {
      reasons.push(`Model mismatch: "${listing.model}" !== "${params.model}"`);
      passes = false;
    } else {
      reasons.push(`Model match: "${listing.model}"`);
    }

    if (listing.year) {
      if (listing.year < yearMin || listing.year > yearMax) {
        reasons.push(`Year ${listing.year} outside range ${yearMin}-${yearMax}`);
        passes = false;
      } else {
        reasons.push(`Year ${listing.year} within range ${yearMin}-${yearMax}`);
      }
    } else {
      reasons.push('Year not specified');
    }

    if (params.mileage && listing.mileage) {
      if (listing.mileage < mileageMin! || listing.mileage > mileageMax!) {
        reasons.push(`Mileage ${listing.mileage.toLocaleString()} outside range ${mileageMin!.toLocaleString()}-${mileageMax!.toLocaleString()}`);
        passes = false;
      } else {
        reasons.push(`Mileage ${listing.mileage.toLocaleString()} within range ${mileageMin!.toLocaleString()}-${mileageMax!.toLocaleString()}`);
      }
    } else if (params.mileage && !listing.mileage) {
      reasons.push('Mileage missing (ranked lower)');
    } else {
      reasons.push('Mileage filter not applied');
    }

    if (passes) {
      const daysAgo = Math.floor(Math.random() * 90);
      const listingDate = new Date();
      listingDate.setDate(listingDate.getDate() - daysAgo);

      const distance = Math.floor(Math.random() * maxDistance) + 5;
      const status: 'active' | 'sold' = Math.random() > 0.35 ? 'active' : 'sold';

      let matchScore = 100;
      if (listing.year) {
        const yearDiff = Math.abs(listing.year - params.year);
        matchScore -= yearDiff * 5;
      }

      if (params.trim && listing.trim) {
        if (listing.trim.toLowerCase() === params.trim.toLowerCase()) {
          matchScore += 10;
          reasons.push(`Trim exact match: "${listing.trim}"`);
        } else {
          matchScore -= 5;
          reasons.push(`Trim mismatch: "${listing.trim}" !== "${params.trim}"`);
        }
      }

      const mileageDiff = params.mileage && listing.mileage ? Math.abs(listing.mileage - params.mileage) : 999999;
      const mileage_quality: 'strong' | 'weak' | 'unknown' =
        !params.mileage || !listing.mileage ? 'unknown' :
        mileageDiff <= 15000 ? 'strong' : 'weak';

      if (!listing.mileage && params.mileage) {
        matchScore -= 20;
      }

      const comp: Comp = {
        status,
        price: listing.price || 0,
        year: listing.year || null,
        make: listing.make || '',
        model: listing.model || '',
        trim: listing.trim || null,
        mileage: listing.mileage || null,
        mileage_quality,
        location_city: 'San Diego',
        location_state: 'CA',
        distance_miles: distance,
        source_name: listing.source_name || 'Unknown',
        source_url: generateSourceUrl(
          listing.source_name || 'Unknown',
          listing.make || '',
          listing.model || '',
          listing.year || 2020
        ),
        listing_date: listingDate.toISOString().split('T')[0],
        seller_type: listing.seller_type || 'unknown',
        match_score: Math.max(0, Math.min(100, Math.round(matchScore))),
      };

      reasons.push(`Match score: ${comp.match_score}`);
      passed.push({ comp, reasons });
    } else {
      rejected.push({ listing, reasons });
    }
  }

  return {
    passed: passed.sort((a, b) => b.comp.match_score - a.comp.match_score).map(p => p.comp),
    rejected,
  };
}

function getVehicleCategory(make: string, model: string): {
  category: 'trike' | 'motorcycle' | 'compact-car' | 'midsize-car' | 'fullsize-car' | 'truck' | 'suv';
  basePrice: number;
  depreciationRate: number;
  mileageImpact: number;
} {
  const makeLower = make.toLowerCase();
  const modelLower = model.toLowerCase();

  if (makeLower === 'can-am') {
    if (modelLower.includes('ryker')) {
      return { category: 'trike', basePrice: 11000, depreciationRate: 0.12, mileageImpact: 0.15 };
    }
    if (modelLower.includes('spyder')) {
      return { category: 'trike', basePrice: 18000, depreciationRate: 0.12, mileageImpact: 0.15 };
    }
  }

  if (makeLower === 'harley-davidson' || makeLower === 'harley' || makeLower === 'honda' && modelLower.includes('cbr')) {
    return { category: 'motorcycle', basePrice: 15000, depreciationRate: 0.10, mileageImpact: 0.20 };
  }

  if (modelLower.includes('f-150') || modelLower.includes('silverado') || modelLower.includes('ram')) {
    return { category: 'truck', basePrice: 40000, depreciationRate: 0.15, mileageImpact: 0.10 };
  }

  if (modelLower.includes('civic') || modelLower.includes('corolla') || modelLower.includes('sentra')) {
    return { category: 'compact-car', basePrice: 22000, depreciationRate: 0.13, mileageImpact: 0.12 };
  }

  if (modelLower.includes('accord') || modelLower.includes('camry') || modelLower.includes('altima')) {
    return { category: 'midsize-car', basePrice: 28000, depreciationRate: 0.14, mileageImpact: 0.12 };
  }

  return { category: 'midsize-car', basePrice: 25000, depreciationRate: 0.14, mileageImpact: 0.12 };
}

function calculateRealisticPrice(
  make: string,
  model: string,
  year: number,
  mileage: number
): number {
  const vehicleInfo = getVehicleCategory(make, model);
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  let price = vehicleInfo.basePrice;

  for (let i = 0; i < age; i++) {
    price *= (1 - vehicleInfo.depreciationRate);
  }

  const excessMileage = Math.max(0, mileage - (age * 3000));
  const mileageDeduction = (excessMileage / 1000) * (price * vehicleInfo.mileageImpact / 100);
  price -= mileageDeduction;

  const variance = (Math.random() - 0.5) * 0.25;
  price *= (1 + variance);

  return Math.max(1000, Math.round(price / 100) * 100);
}

function generateAdditionalComps(
  params: KittyCompsSearchParams,
  existing: Comp[],
  count: number,
  maxDistance: number
): Comp[] {
  const additional: Comp[] = [];
  const usedSources = new Set(existing.map(c => c.source_name));

  for (let i = 0; i < count; i++) {
    const yearVariance = Math.floor(Math.random() * 5) - 2;
    const year = params.year + yearVariance;

    const mileageBase = params.mileage || 5000;
    const mileageVariance = Math.floor((Math.random() - 0.5) * 10000);
    const mileage = Math.max(1000, mileageBase + mileageVariance);

    const price = calculateRealisticPrice(params.make, params.model, year, mileage);

    let source = EXPANDED_SOURCES[Math.floor(Math.random() * EXPANDED_SOURCES.length)];
    let attempts = 0;
    while (usedSources.has(source) && attempts < 20) {
      source = EXPANDED_SOURCES[Math.floor(Math.random() * EXPANDED_SOURCES.length)];
      attempts++;
    }
    usedSources.add(source);

    const status: 'active' | 'sold' = Math.random() > 0.35 ? 'active' : 'sold';
    const seller_type: 'dealer' | 'private' = Math.random() > 0.5 ? 'dealer' : 'private';

    const daysAgo = Math.floor(Math.random() * 90);
    const listingDate = new Date();
    listingDate.setDate(listingDate.getDate() - daysAgo);

    const distance = Math.floor(Math.random() * maxDistance) + 5;

    let matchScore = 100;
    const yearDiff = Math.abs(year - params.year);
    matchScore -= yearDiff * 5;

    const mileageDiff = params.mileage ? Math.abs(mileage - params.mileage) : 999999;
    const mileage_quality: 'strong' | 'weak' | 'unknown' =
      !params.mileage ? 'unknown' :
      mileageDiff <= 15000 ? 'strong' : 'weak';

    additional.push({
      status,
      price,
      year,
      make: params.make,
      model: params.model,
      trim: params.trim || null,
      mileage,
      mileage_quality,
      location_city: 'San Diego',
      location_state: 'CA',
      distance_miles: distance,
      source_name: source,
      source_url: generateSourceUrl(source, params.make, params.model, year),
      listing_date: listingDate.toISOString().split('T')[0],
      seller_type,
      match_score: Math.max(0, Math.min(100, Math.round(matchScore))),
    });
  }

  return additional;
}

function calculateMedianWithOutlierTrimming(prices: number[]): { median: number; low: number; high: number; trimmed: number[] } {
  if (prices.length === 0) {
    return { median: 0, low: 0, high: 0, trimmed: [] };
  }

  const sorted = [...prices].sort((a, b) => a - b);

  let trimmed = sorted;
  if (sorted.length >= 10) {
    const trimCount = Math.ceil(sorted.length * 0.1);
    trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  }

  const median = trimmed.length > 0
    ? trimmed[Math.floor(trimmed.length / 2)]
    : sorted[Math.floor(sorted.length / 2)];

  const low = Math.min(...trimmed);
  const high = Math.max(...trimmed);

  return { median, low, high, trimmed };
}

export function runKittyCompsSearch(params: KittyCompsSearchParams): KittyCompsSearchResult {
  const maxDistance = 100;
  const yearRange = 2;

  const expansion: KittyCompsExpansion = {
    radiusExpanded: false,
    yearRangeExpanded: false,
    mileageIgnored: false,
    finalRadius: maxDistance,
    finalYearRange: yearRange,
  };

  const filterResult = filterListings(MOCK_LISTINGS, params, maxDistance);
  let comps = filterResult.passed;
  const rejectedListings = filterResult.rejected;

  if (comps.length < 5) {
    const needed = Math.max(5, 10) - comps.length;
    const additional = generateAdditionalComps(params, comps, needed, maxDistance);
    comps = [...comps, ...additional].sort((a, b) => b.match_score - a.match_score);
  } else if (comps.length > 10) {
    comps = comps.slice(0, 10);
  } else if (comps.length < 10) {
    const needed = 10 - comps.length;
    const additional = generateAdditionalComps(params, comps, needed, maxDistance);
    comps = [...comps, ...additional].sort((a, b) => b.match_score - a.match_score);
  }

  const prices = comps.map(c => c.price);
  const { median, low, high, trimmed } = calculateMedianWithOutlierTrimming(prices);

  const average = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  const typicalOfferPercentage = 10;
  const typicalOffer = Math.round(median * (1 - typicalOfferPercentage / 100));

  const summary: CompsSummary = {
    count_active: comps.filter(c => c.status === 'active').length,
    count_sold: comps.filter(c => c.status === 'sold').length,
    average_price: average,
    median_price: median,
    low_price: low,
    high_price: high,
    typical_offer: typicalOffer,
    typical_offer_percentage: typicalOfferPercentage,
    last_updated: new Date().toISOString(),
  };

  const debug: FilterDebugInfo = {
    passed: comps.map(comp => ({
      comp,
      reasons: [
        `Make: ${comp.make}`,
        `Model: ${comp.model}`,
        `Year: ${comp.year} (within ${params.year - 2}-${params.year + 2})`,
        comp.mileage && params.mileage
          ? `Mileage: ${comp.mileage.toLocaleString()} (within ${(params.mileage - 15000).toLocaleString()}-${(params.mileage + 15000).toLocaleString()})`
          : comp.mileage ? `Mileage: ${comp.mileage.toLocaleString()}` : 'Mileage: Not listed',
        `Distance: ${comp.distance_miles} mi`,
        `Match score: ${comp.match_score}`,
      ],
    })),
    rejected: rejectedListings,
    filterCriteria: {
      make: params.make,
      model: params.model,
      yearMin: params.year - 2,
      yearMax: params.year + 2,
      mileageMin: params.mileage ? params.mileage - 15000 : undefined,
      mileageMax: params.mileage ? params.mileage + 15000 : undefined,
      maxDistance,
    },
  };

  return {
    comps,
    summary,
    expansion,
    searchParams: params,
    debug,
  };
}
