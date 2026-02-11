import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Copy, Loader2, Upload, ChevronDown, ChevronUp, Sparkles, RefreshCw } from 'lucide-react';
import type { InventoryItem, Status, CachedEstimate, CachedComps } from '../types/inventory';
import { getItem, saveItem } from '../utils/db';
import { getBuyFee, getTotalDue } from '../utils/buyFee';
import { generateBuddyTag } from '../utils/buddyTag';
import { parseCompsCSV, calculateCompsSummary } from '../utils/comps';
import { Comp, CompsResult } from '../types/comps';
import { getAIEstimate, type EstimateResult } from '../services/aiEstimate';
import { searchCompsWithCache, clearCompsCache, type Comp as MarketComp, type MultiSourceResult } from '../services/multiSourceComps';

interface ItemDetailScreenProps {
  itemId: string;
  onClose: () => void;
}

type ReportType = 'comps' | 'aiEstimate' | 'issues' | 'risk' | null;

export default function ItemDetailScreen({ itemId, onClose }: ItemDetailScreenProps) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [status, setStatus] = useState<Status>('unreviewed');
  const [maxBid, setMaxBid] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sayBrahLoading, setSayBrahLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [reportContent, setReportContent] = useState<any>(null);
  const [compsData, setCompsData] = useState<CompsResult | null>(null);
  const [multiComps, setMultiComps] = useState<MultiSourceResult | null>(null);
  const [aiEstimate, setAiEstimate] = useState<EstimateResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    setLoading(true);
    try {
      const found = await getItem(itemId);
      if (found) {
        setItem(found);
        setStatus(found.status);
        setMaxBid(found.maxBid?.toString() || '');
        setNote(found.note);

        // Load cached estimate if available
        if (found.cachedEstimate) {
          setAiEstimate({
            vehicle: `${found.year || ''} ${found.make} ${found.model}`.trim(),
            mileage: found.milesHours || 'unknown',
            condition: 'good',
            estimate: {
              low: found.cachedEstimate.low,
              mid: found.cachedEstimate.mid,
              high: found.cachedEstimate.high,
              confidence: found.cachedEstimate.confidence,
              notes: '',
              factors: [],
            },
            source: found.cachedEstimate.source,
            timestamp: new Date(found.cachedEstimate.fetchedAt).toISOString(),
          });
        } else {
          // Auto-fetch AI estimate if not cached
          fetchAndCacheEstimate(found);
        }
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAndCacheEstimate = async (itemData: InventoryItem) => {
    try {
      const year = itemData.year?.toString() || null;
      const mileage = itemData.milesHours || null;

      const result = await getAIEstimate(year, itemData.make, itemData.model, mileage);
      setAiEstimate(result);

      // Cache the estimate to the item
      const cachedEstimate: CachedEstimate = {
        low: result.estimate.low,
        mid: result.estimate.mid,
        high: result.estimate.high,
        confidence: result.estimate.confidence,
        source: result.source as 'gemini' | 'heuristic',
        fetchedAt: Date.now(),
      };

      const updated: InventoryItem = {
        ...itemData,
        cachedEstimate,
      };

      await saveItem(updated);
      setItem(updated);
    } catch (error) {
      console.error('Auto-estimate error:', error);
    }
  };

  const handleSave = async () => {
    if (!item) return;

    setSaving(true);
    try {
      const maxBidNum = maxBid.trim() ? parseFloat(maxBid) : null;

      let buddyTag = item.buddyTag;
      if ((status === 'interested' || status === 'maybe') && !buddyTag) {
        buddyTag = generateBuddyTag();
      }

      const updated: InventoryItem = {
        ...item,
        status,
        maxBid: maxBidNum,
        note: note.trim(),
        buddyTag,
        updatedAt: Date.now(),
      };

      await saveItem(updated);
      setItem(updated);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  const getSearchQuery = () => {
    if (!item) return '';
    // Use make + model ONLY for broad search (gets more results)
    // We filter for specific variants on the client side
    const parts = [item.make, item.model].filter(Boolean);
    return parts.join(' ');
  };

  // Filter comps to exclude mismatched variants (e.g., searching for 600, exclude 900)
  const filterCompsForItem = (comps: MarketComp[]): MarketComp[] => {
    if (!item) return comps;

    // Extract numbers from the model (e.g., "Ryker 600" -> ["600"])
    const modelNumbers = item.model.match(/\d{3,4}/g) || [];

    if (modelNumbers.length === 0) {
      return comps; // No specific variant, return all
    }

    // Filter out comps that have DIFFERENT variant numbers
    return comps.filter(comp => {
      const compTitle = comp.title.toLowerCase();
      const compNumbers = compTitle.match(/\d{3,4}/g) || [];

      // If comp has no numbers, include it
      if (compNumbers.length === 0) return true;

      // Check if any of our model numbers appear in the comp
      return modelNumbers.some(num => compNumbers.includes(num));
    });
  };

  const handleRunComps = async (forceRefresh: boolean = false) => {
    if (!item) return;
    setSayBrahLoading(true);
    setActiveReport('comps');

    try {
      const searchQuery = getSearchQuery();
      console.log('Running comps search for:', searchQuery, 'forceRefresh:', forceRefresh);
      const result = await searchCompsWithCache(searchQuery, forceRefresh);

      // Filter comps to match the specific model variant
      const filteredComps = filterCompsForItem(result.comps);
      const filteredResult = { ...result, comps: filteredComps };
      setMultiComps(filteredResult);

      console.log(`Comps: ${result.comps.length} found, ${filteredComps.length} after filtering for model match`);

      // Calculate summary from filtered comps
      if (filteredComps.length > 0) {
        const prices = filteredComps.map(c => c.price);
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        const lowPrice = Math.min(...prices);
        const highPrice = Math.max(...prices);

        setReportContent({
          multiComps: filteredResult,
          summary: {
            average_price: avgPrice,
            low_price: lowPrice,
            high_price: highPrice,
          },
          fromCache: result.fromCache,
          lastUpdated: result.lastUpdated,
        });

        // Cache comps summary to the item for offline access
        const sourcesUsed = Object.entries(result.sources)
          .filter(([_, count]) => count > 0)
          .map(([source]) => source);

        const cachedComps: CachedComps = {
          avgPrice,
          lowPrice,
          highPrice,
          count: filteredComps.length,
          sources: sourcesUsed,
          fetchedAt: Date.now(),
        };

        const updated: InventoryItem = { ...item, cachedComps };
        await saveItem(updated);
        setItem(updated);
      } else {
        // No comps found - auto-fetch AI estimate as fallback
        console.log('No comps found, fetching AI estimate as fallback');
        if (!aiEstimate || aiEstimate.source === 'heuristic') {
          // Fetch fresh AI estimate if we don't have one or only have heuristic
          const year = item.year?.toString() || null;
          const mileage = item.milesHours || null;
          const result = await getAIEstimate(year, item.make, item.model, mileage);
          setAiEstimate(result);

          // Cache the AI estimate
          const cachedEstimate: CachedEstimate = {
            low: result.estimate.low,
            mid: result.estimate.mid,
            high: result.estimate.high,
            confidence: result.estimate.confidence,
            source: result.source as 'gemini' | 'heuristic',
            fetchedAt: Date.now(),
          };
          const updated: InventoryItem = { ...item, cachedEstimate };
          await saveItem(updated);
          setItem(updated);
        }

        setReportContent({
          multiComps: null,
          noComps: true,
          message: 'No market comps found. Using AI estimate instead.',
        });
      }
    } catch (error) {
      console.error('Multi-source comps error:', error);
      setReportContent({
        multiComps: null,
        error: error instanceof Error ? error.message : 'Failed to fetch comps',
      });
    }

    setSayBrahLoading(false);
  };

  const handleAIEstimate = async () => {
    if (!item) return;
    setSayBrahLoading(true);
    setActiveReport('aiEstimate');

    try {
      const year = item.year?.toString() || null;
      const mileage = item.milesHours || null;

      const result = await getAIEstimate(year, item.make, item.model, mileage);
      setAiEstimate(result);
      setReportContent({ aiEstimate: result });

      // Also cache it to the item
      const cachedEstimate: CachedEstimate = {
        low: result.estimate.low,
        mid: result.estimate.mid,
        high: result.estimate.high,
        confidence: result.estimate.confidence,
        source: result.source as 'gemini' | 'heuristic',
        fetchedAt: Date.now(),
      };
      const updated: InventoryItem = { ...item, cachedEstimate };
      await saveItem(updated);
      setItem(updated);
    } catch (error) {
      console.error('AI estimate error:', error);
      setReportContent({
        error: error instanceof Error ? error.message : 'Failed to get estimate',
      });
    }

    setSayBrahLoading(false);
  };

  const handleImportCompsCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const comps = parseCompsCSV(text);

    if (comps.length >= 5) {
      const summary = calculateCompsSummary(comps);
      const result: CompsResult = { comps, summary };
      setCompsData(result);
      setReportContent({ compsResult: result });
      setActiveReport('comps');
      setShowImportModal(false);
    } else {
      alert('CSV must contain at least 5 valid comps with source_name, source_url, and price.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKnownIssues = async () => {
    if (!item) return;
    setSayBrahLoading(true);
    setActiveReport('issues');

    const vehicleDesc = `${item.year || ''} ${item.make} ${item.model}`.trim();
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are an expert powersports mechanic specializing in motorcycles, ATVs, and three-wheelers. I'm considering buying a USED ${vehicleDesc} at auction.

List the TOP 6 most important problems and red flags for THIS SPECIFIC vehicle:

MUST INCLUDE IF APPLICABLE:
- Year-specific recalls (NHTSA recalls for this model year)
- Chronic/known defects (bad transmissions, overheating issues, electrical gremlins)
- Model years to avoid vs good years
- Common mechanical failures and at what mileage
- Parts that are expensive to replace or hard to find
- Specific inspection points for auction buyers

For each issue, explain WHY it matters and what to physically check.

Respond ONLY with valid JSON array:
[
  {"issue": "<specific problem>", "detail": "<what to check and why it matters>", "severity": "<high/medium/low>"},
  ...
]

Be brutally honest. Include year-specific problems. No generic advice like "check the tires".`
                }]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 800,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const issues = JSON.parse(jsonMatch[0]);
              setReportContent({ issues, vehicle: vehicleDesc, source: 'gemini' });
              setSayBrahLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        console.error('Gemini issues error:', e);
      }
    }

    // Fallback to basic issues
    setReportContent({
      issues: [
        { issue: 'Battery condition', detail: 'Check voltage and load test the battery', severity: 'medium' },
        { issue: 'Tire wear and age', detail: 'Look for dry rot, uneven wear, and manufacture date', severity: 'medium' },
        { issue: 'Brake system', detail: 'Check pad thickness, rotor condition, and brake fluid', severity: 'high' },
        { issue: 'Service history', detail: 'Verify maintenance records and interval compliance', severity: 'medium' },
      ],
      vehicle: vehicleDesc,
      source: 'fallback'
    });
    setSayBrahLoading(false);
  };

  const handleRiskScore = async () => {
    if (!item) return;
    setSayBrahLoading(true);
    setActiveReport('risk');

    await new Promise(resolve => setTimeout(resolve, 1000));

    let score = 'Medium';
    let reason = 'Standard risk profile for this vehicle type.';

    const itemYear = item.year || 2020;
    const bidValue = maxBid.trim() ? parseFloat(maxBid) : 0;

    if (itemYear <= 2013) {
      score = 'High';
      reason = 'Older vehicle may have higher maintenance costs and unknown history.';
    } else if (!bidValue || isNaN(bidValue)) {
      score = 'Medium';
      reason = 'Bid information unavailable for full risk assessment.';
    } else if (bidValue > 10000) {
      score = 'Low';
      reason = 'Higher value vehicle typically indicates better condition and maintenance.';
    }

    setReportContent({ score, reason });
    setSayBrahLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface-900 z-50 flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="fixed inset-0 bg-surface-900 z-50 flex items-center justify-center">
        <div className="text-zinc-500">Item not found</div>
      </div>
    );
  }

  const buyFee = maxBid.trim() ? getBuyFee(parseFloat(maxBid)) : null;
  const totalDue = maxBid.trim() ? getTotalDue(parseFloat(maxBid)) : null;

  const getStatusStyle = (s: Status) => {
    switch (s) {
      case 'interested': return 'bg-status-success text-white';
      case 'maybe': return 'bg-status-warning text-white';
      case 'pass': return 'bg-status-danger text-white';
      default: return 'bg-surface-600 text-zinc-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-900 z-50 overflow-y-auto">
      <div className="bg-surface-800 border-b border-surface-500/30 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onClose} className="text-electric font-medium">
            Cancel
          </button>
          <h1 className="font-semibold text-white">Item Details</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-electric font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto pb-20">
        {item.photoUrl && (
          <img
            src={item.photoUrl}
            alt={item.title}
            className="w-full h-56 object-cover"
          />
        )}

        <div className="p-4 space-y-4">
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-electric font-bold text-xl">#{item.itemNumber}</span>
                  {item.buddyTag && (
                    <span className="text-xs bg-surface-600 text-zinc-400 px-2 py-0.5 rounded font-medium">
                      {item.buddyTag}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">{item.category}</div>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusStyle(item.status)}`}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-white mb-3">{item.title}</h2>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {item.year && (
                <div>
                  <div className="text-zinc-500 text-xs">Year</div>
                  <div className="text-white font-medium">{item.year}</div>
                </div>
              )}
              {item.make && (
                <div>
                  <div className="text-zinc-500 text-xs">Make</div>
                  <div className="text-white font-medium">{item.make}</div>
                </div>
              )}
              {item.model && (
                <div>
                  <div className="text-zinc-500 text-xs">Model</div>
                  <div className="text-white font-medium">{item.model}</div>
                </div>
              )}
              {item.milesHours && (
                <div>
                  <div className="text-zinc-500 text-xs">Miles/Hours</div>
                  <div className="text-white font-medium">{item.milesHours}</div>
                </div>
              )}
              {item.vin && (
                <div>
                  <div className="text-zinc-500 text-xs">VIN</div>
                  <div className="text-white font-medium font-mono text-sm">{item.vin}</div>
                </div>
              )}
              {item.docs && (
                <div>
                  <div className="text-zinc-500 text-xs">Docs</div>
                  <div className="text-status-success font-medium">{item.docs}</div>
                </div>
              )}
              {item.crScore !== null && (
                <div>
                  <div className="text-zinc-500 text-xs">CR Score</div>
                  <div className="text-white font-medium">{item.crScore}</div>
                </div>
              )}
            </div>

            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-electric text-sm font-medium mt-3"
              >
                <ExternalLink size={14} />
                View Source
              </a>
            )}
          </div>

          {/* Suggested Max Bid Card */}
          {aiEstimate ? (() => {
            // Calculate suggested bid at 75% of market value (25% margin for profit/fees)
            let suggestedBid = Math.round(aiEstimate.estimate.mid * 0.75);

            // Special pricing rules for specific models
            const modelUpper = item.model.toUpperCase();
            const makeUpper = item.make.toUpperCase();
            let priceOverride = false;

            // Ryker pricing caps
            if ((makeUpper.includes('CAN-AM') || makeUpper.includes('CAN AM')) && modelUpper.includes('RYKER')) {
              if (modelUpper.includes('600')) {
                // Ryker 600 - cap at $4,200 max bid (entry level, low resale)
                suggestedBid = Math.min(suggestedBid, 4200);
                priceOverride = suggestedBid === 4200;
              } else if (modelUpper.includes('900')) {
                // Ryker 900 - cap at $5,000 max bid
                suggestedBid = Math.min(suggestedBid, 5000);
                priceOverride = suggestedBid === 5000;
              }
            }

            return (
              <div className="card p-4 bg-gradient-to-r from-electric/5 to-status-success/5 border border-electric/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-electric" />
                  <span className="text-sm font-medium text-zinc-400">Suggested Max Bid</span>
                  <span className="ml-auto text-xs text-zinc-500 bg-surface-600 px-2 py-0.5 rounded">
                    {priceOverride ? 'Model Cap' : `75% of ${aiEstimate.source === 'gemini' ? 'AI' : 'Est'}`}
                  </span>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <div className="text-3xl font-bold text-electric tabular-nums">
                      ${suggestedBid.toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Market: ${aiEstimate.estimate.low.toLocaleString()} - ${aiEstimate.estimate.high.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setMaxBid(suggestedBid.toString())}
                    className="px-4 py-2 bg-electric text-surface-900 text-sm font-semibold rounded-xl active:opacity-80"
                  >
                    Use as Max
                  </button>
                </div>
              </div>
            );
          })() : !loading && (
            <div className="card p-4 border border-dashed border-surface-500">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="text-electric animate-spin" />
                <span className="text-sm text-zinc-500">Getting price estimate...</span>
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-500 block mb-2">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['unreviewed', 'interested', 'maybe', 'pass'] as Status[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                        status === s
                          ? getStatusStyle(s)
                          : 'bg-surface-600 text-zinc-400'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-500 block mb-2">Max Bid</label>
                <input
                  type="number"
                  value={maxBid}
                  onChange={e => setMaxBid(e.target.value)}
                  placeholder="$0"
                  className="input-field text-lg font-semibold"
                />
                {buyFee !== null && totalDue !== null && (
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-zinc-500">Fee: ${buyFee.toLocaleString()}</span>
                    <span className="text-electric font-medium">Total: ${totalDue.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-zinc-500 block mb-2">Notes</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 active:bg-surface-600"
            >
              <span className="font-medium text-white">Research Tools</span>
              {showAdvanced ? (
                <ChevronUp size={20} className="text-zinc-500" />
              ) : (
                <ChevronDown size={20} className="text-zinc-500" />
              )}
            </button>

            {showAdvanced && (
              <div className="border-t border-surface-500/30 p-4 space-y-3">
                <button
                  onClick={() => copyToClipboard(getSearchQuery(), 'Search query')}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  Copy Search Query
                </button>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => handleRunComps(false)}
                    disabled={sayBrahLoading}
                    className="btn-primary text-sm py-2 disabled:opacity-50"
                  >
                    Market Comps
                  </button>
                  <button
                    onClick={() => handleRunComps(true)}
                    disabled={sayBrahLoading}
                    className="btn-secondary text-sm py-2 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={14} />
                    Fresh Comps
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={handleAIEstimate}
                    disabled={sayBrahLoading || !item}
                    className="btn-secondary text-sm py-2 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Sparkles size={14} />
                    AI Estimate
                  </button>
                  <button
                    onClick={() => { clearCompsCache(); alert('Comps cache cleared!'); }}
                    className="btn-secondary text-sm py-2 text-status-warning"
                  >
                    Clear Cache
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleKnownIssues}
                    disabled={sayBrahLoading}
                    className="btn-secondary text-sm py-2 disabled:opacity-50"
                  >
                    Known Issues
                  </button>
                  <button
                    onClick={handleRiskScore}
                    disabled={sayBrahLoading}
                    className="btn-secondary text-sm py-2 disabled:opacity-50"
                  >
                    Risk Score
                  </button>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {sayBrahLoading && (
            <div className="card p-8 flex items-center justify-center">
              <Loader2 size={32} className="text-electric animate-spin" />
            </div>
          )}

          {!sayBrahLoading && reportContent && activeReport === 'comps' && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Market Comps</h3>
                {reportContent.lastUpdated && (
                  <span className="text-xs text-zinc-500">
                    {reportContent.fromCache ? 'Cached' : 'Updated'} {reportContent.lastUpdated}
                  </span>
                )}
              </div>

              {/* Source breakdown */}
              {reportContent.multiComps?.sources && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {reportContent.multiComps.sources.ebay > 0 && (
                    <span className="text-xs bg-status-info/20 text-status-info px-2 py-0.5 rounded">
                      eBay: {reportContent.multiComps.sources.ebay}
                    </span>
                  )}
                  {reportContent.multiComps.sources.cycletrader > 0 && (
                    <span className="text-xs bg-status-success/20 text-status-success px-2 py-0.5 rounded">
                      CycleTrader: {reportContent.multiComps.sources.cycletrader}
                    </span>
                  )}
                  {reportContent.multiComps.sources.craigslist > 0 && (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                      Craigslist: {reportContent.multiComps.sources.craigslist}
                    </span>
                  )}
                  {reportContent.multiComps.sources.rvtrader > 0 && (
                    <span className="text-xs bg-status-warning/20 text-status-warning px-2 py-0.5 rounded">
                      RVTrader: {reportContent.multiComps.sources.rvtrader}
                    </span>
                  )}
                </div>
              )}

              {reportContent.noComps && (
                <div className="bg-electric/10 text-electric rounded-xl p-3 text-sm mb-3 flex items-center gap-2">
                  <Sparkles size={16} />
                  {reportContent.message}
                </div>
              )}

              {reportContent.error && !reportContent.noComps && (
                <div className="bg-status-warning/10 text-status-warning rounded-xl p-3 text-sm mb-3">
                  {reportContent.error}
                </div>
              )}

              {reportContent.summary && (
                <div className="bg-surface-600 rounded-xl p-3 mb-3">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <div className="text-zinc-500 text-xs">Average</div>
                      <div className="text-white font-semibold tabular-nums">
                        ${reportContent.summary.average_price.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs">Low</div>
                      <div className="text-status-success font-semibold tabular-nums">
                        ${reportContent.summary.low_price.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 text-xs">High</div>
                      <div className="text-status-danger font-semibold tabular-nums">
                        ${reportContent.summary.high_price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {reportContent.multiComps?.comps && reportContent.multiComps.comps.length > 0 && (
                <div className="space-y-2">
                  {reportContent.multiComps.comps.slice(0, 15).map((comp: MarketComp, idx: number) => (
                    <a
                      key={idx}
                      href={comp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-surface-600 rounded-xl p-3 active:bg-surface-500"
                    >
                      <div className="flex gap-3">
                        {comp.imageUrl && (
                          <img
                            src={comp.imageUrl}
                            alt={comp.title}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium line-clamp-1">
                            {comp.title}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-status-success font-semibold tabular-nums">
                              ${comp.price.toLocaleString()}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              comp.source === 'ebay' ? 'bg-status-info/20 text-status-info' :
                              comp.source === 'cycletrader' ? 'bg-status-success/20 text-status-success' :
                              comp.source === 'craigslist' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-status-warning/20 text-status-warning'
                            }`}>
                              {comp.source === 'ebay' ? 'eBay Sold' :
                               comp.source === 'cycletrader' ? 'CycleTrader' :
                               comp.source === 'craigslist' ? 'Craigslist' : 'RVTrader'}
                            </span>
                          </div>
                          {comp.location && (
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {comp.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {!sayBrahLoading && reportContent && activeReport === 'aiEstimate' && reportContent.aiEstimate && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-electric" />
                <h3 className="font-semibold text-white">AI Price Estimate</h3>
                <span className="ml-auto text-xs text-zinc-500 bg-surface-600 px-2 py-0.5 rounded">
                  {reportContent.aiEstimate.source === 'heuristic' ? 'Estimated' : reportContent.aiEstimate.source}
                </span>
              </div>

              <div className="text-sm text-zinc-500 mb-4">{reportContent.aiEstimate.vehicle}</div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-600 rounded-xl p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">Low</div>
                  <div className="text-lg font-bold text-status-success tabular-nums">
                    ${reportContent.aiEstimate.estimate.low.toLocaleString()}
                  </div>
                </div>
                <div className="bg-electric/10 rounded-xl p-3 text-center">
                  <div className="text-xs text-electric mb-1">Fair Price</div>
                  <div className="text-xl font-bold text-electric tabular-nums">
                    ${reportContent.aiEstimate.estimate.mid.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-600 rounded-xl p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">High</div>
                  <div className="text-lg font-bold text-status-warning tabular-nums">
                    ${reportContent.aiEstimate.estimate.high.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="text-sm text-zinc-400 mb-3">
                {reportContent.aiEstimate.estimate.notes}
              </div>

              <div className="flex flex-wrap gap-2">
                {reportContent.aiEstimate.estimate.factors.map((factor: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs bg-surface-600 text-zinc-400 px-2 py-1 rounded"
                  >
                    {factor}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-surface-500/30 text-xs text-zinc-500">
                Confidence: {reportContent.aiEstimate.estimate.confidence}
              </div>
            </div>
          )}

          {!sayBrahLoading && reportContent && activeReport === 'issues' && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Known Issues</h3>
                {reportContent.source === 'gemini' && (
                  <span className="text-xs text-electric bg-electric/10 px-2 py-0.5 rounded">AI Powered</span>
                )}
              </div>
              {reportContent.vehicle && (
                <div className="text-sm text-zinc-500 mb-3">{reportContent.vehicle}</div>
              )}
              <div className="space-y-3">
                {reportContent.issues.map((issue: { issue: string; detail: string; severity: string } | string, idx: number) => (
                  typeof issue === 'string' ? (
                    <div key={idx} className="bg-surface-600 rounded-xl p-3 text-sm text-zinc-300">
                      {issue}
                    </div>
                  ) : (
                    <div key={idx} className="bg-surface-600 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-white text-sm">{issue.issue}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          issue.severity === 'high' ? 'bg-status-danger/20 text-status-danger' :
                          issue.severity === 'medium' ? 'bg-status-warning/20 text-status-warning' :
                          'bg-status-success/20 text-status-success'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">{issue.detail}</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {!sayBrahLoading && reportContent && activeReport === 'risk' && (
            <div className="card p-4">
              <h3 className="font-semibold text-white mb-3">Risk Assessment</h3>
              <div className="bg-surface-600 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-500 text-sm">Risk Level</span>
                  <span className={`font-bold ${
                    reportContent.score === 'Low' ? 'text-status-success' :
                    reportContent.score === 'High' ? 'text-status-danger' :
                    'text-status-warning'
                  }`}>
                    {reportContent.score}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{reportContent.reason}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowImportModal(false)}>
          <div className="bg-surface-800 rounded-t-3xl w-full max-w-lg p-5 pb-10 border-t border-surface-500/30" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-500 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-semibold text-white mb-3">Import Comps CSV</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Upload a CSV file with at least 5 comps. Required columns: source_name, source_url, price.
            </p>
            <div className="flex gap-3">
              <button onClick={handleImportCompsCSV} className="flex-1 btn-primary">
                Choose File
              </button>
              <button onClick={() => setShowImportModal(false)} className="flex-1 btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
