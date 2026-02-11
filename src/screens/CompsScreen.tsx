import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Clock, Wifi, WifiOff, Sparkles, TrendingUp, RefreshCw } from 'lucide-react';
import { searchCompsWithCache, clearCompsCache, type Comp, type MultiSourceResult } from '../services/multiSourceComps';
import { getAIEstimate, type EstimateResult } from '../services/aiEstimate';

interface CompsScreenProps {
  onBack: () => void;
}

type TabType = 'ebay' | 'estimate';

export default function CompsScreen({ onBack }: CompsScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ebay');
  const [query, setQuery] = useState('');
  const [compsResult, setCompsResult] = useState<MultiSourceResult | null>(null);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [usedCache, setUsedCache] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setUsedCache(false);

    if (activeTab === 'ebay') {
      try {
        const result = await searchCompsWithCache(query.trim());
        setCompsResult(result);
        setLastUpdated(result.lastUpdated);
        setUsedCache(result.fromCache);
        if (result.comps.length === 0) {
          setError('No comps found. Try a different search.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setCompsResult(null);
      }
    } else {
      // AI Estimate
      try {
        // Parse query into year, make, model
        const parts = query.trim().split(/\s+/);
        let year: string | null = null;
        let make = '';
        let model = '';

        // Check if first part is a year
        if (parts[0] && /^\d{4}$/.test(parts[0])) {
          year = parts[0];
          make = parts[1] || '';
          model = parts.slice(2).join(' ') || '';
        } else {
          make = parts[0] || '';
          model = parts.slice(1).join(' ') || '';
        }

        const result = await getAIEstimate(year, make, model);
        setEstimate(result);
        setLastUpdated('just now');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Estimate failed');
        setEstimate(null);
      }
    }

    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCompsResult(null);
    setEstimate(null);
    setError(null);
  };

  const comps = compsResult?.comps || [];
  const avgPrice = comps.length > 0
    ? Math.round(comps.reduce((sum, c) => sum + c.price, 0) / comps.length)
    : null;

  return (
    <div className="min-h-screen bg-surface-900 pb-20">
      <div className="bg-surface-800 border-b border-surface-500/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center -ml-2 text-electric"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-semibold text-white">Comps Lookup</h1>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => { clearCompsCache(); alert('Cache cleared!'); }}
              className="text-zinc-500 active:text-electric"
              title="Clear cache"
            >
              <RefreshCw size={18} />
            </button>
            {isOnline ? (
              <Wifi size={18} className="text-status-success" />
            ) : (
              <WifiOff size={18} className="text-zinc-500" />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-3 gap-2">
          <button
            onClick={() => handleTabChange('ebay')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'ebay'
                ? 'bg-electric text-surface-900'
                : 'bg-surface-600 text-zinc-400'
            }`}
          >
            <TrendingUp size={16} />
            Market Comps
          </button>
          <button
            onClick={() => handleTabChange('estimate')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'estimate'
                ? 'bg-electric text-surface-900'
                : 'bg-surface-600 text-zinc-400'
            }`}
          >
            <Sparkles size={16} />
            AI Estimate
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={activeTab === 'ebay' ? 'Search all markets...' : 'Year Make Model (e.g. 2019 Can-Am Spyder)'}
            className="input-field flex-1"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="btn-primary px-4 disabled:opacity-50"
          >
            {activeTab === 'ebay' ? <Search size={20} /> : <Sparkles size={20} />}
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="text-zinc-500">
              {activeTab === 'ebay' ? 'Searching eBay, CycleTrader, Craigslist...' : 'Getting estimate...'}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-status-warning/10 text-status-warning rounded-xl p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Market Comps Results */}
        {activeTab === 'ebay' && comps.length > 0 && (
          <>
            <div className="card p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-zinc-500 text-sm">Avg. Price</div>
                  <div className="text-2xl font-bold text-status-success tabular-nums">
                    ${avgPrice?.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-500 text-sm">{comps.length} comps</div>
                  {lastUpdated && (
                    <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                      <Clock size={12} />
                      {usedCache ? 'Cached' : 'Updated'} {lastUpdated}
                    </div>
                  )}
                </div>
              </div>
              {/* Source breakdown */}
              {compsResult?.sources && (
                <div className="flex flex-wrap gap-1 pt-2 border-t border-surface-500/30">
                  {compsResult.sources.ebay > 0 && (
                    <span className="text-xs bg-status-info/20 text-status-info px-2 py-0.5 rounded">
                      eBay: {compsResult.sources.ebay}
                    </span>
                  )}
                  {compsResult.sources.cycletrader > 0 && (
                    <span className="text-xs bg-status-success/20 text-status-success px-2 py-0.5 rounded">
                      CycleTrader: {compsResult.sources.cycletrader}
                    </span>
                  )}
                  {compsResult.sources.craigslist > 0 && (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                      Craigslist: {compsResult.sources.craigslist}
                    </span>
                  )}
                  {compsResult.sources.rvtrader > 0 && (
                    <span className="text-xs bg-status-warning/20 text-status-warning px-2 py-0.5 rounded">
                      RVTrader: {compsResult.sources.rvtrader}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {comps.map((comp, index) => (
                <a
                  key={index}
                  href={comp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-interactive block p-3"
                >
                  <div className="flex gap-3">
                    {comp.imageUrl && (
                      <img
                        src={comp.imageUrl}
                        alt={comp.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white line-clamp-2">
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
                          {comp.source === 'ebay' ? 'eBay' :
                           comp.source === 'cycletrader' ? 'CycleTrader' :
                           comp.source === 'craigslist' ? 'CL' : 'RVTrader'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {comp.date}{comp.location ? ` • ${comp.location}` : ''}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        {/* AI Estimate Results */}
        {activeTab === 'estimate' && estimate && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-electric" />
                <span className="font-semibold text-white">Private Party Estimate</span>
                <span className="ml-auto text-xs text-zinc-500 bg-surface-600 px-2 py-0.5 rounded">
                  {estimate.source === 'heuristic' ? 'Estimated' : 'AI'}
                </span>
              </div>

              <div className="text-sm text-zinc-500 mb-4">{estimate.vehicle}</div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-600 rounded-xl p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">Low</div>
                  <div className="text-lg font-bold text-status-success tabular-nums">
                    ${estimate.estimate.low.toLocaleString()}
                  </div>
                </div>
                <div className="bg-electric/10 rounded-xl p-3 text-center">
                  <div className="text-xs text-electric mb-1">Fair Price</div>
                  <div className="text-xl font-bold text-electric tabular-nums">
                    ${estimate.estimate.mid.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-600 rounded-xl p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">High</div>
                  <div className="text-lg font-bold text-status-warning tabular-nums">
                    ${estimate.estimate.high.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="text-sm text-zinc-400 mb-3">
                {estimate.estimate.notes}
              </div>

              <div className="flex flex-wrap gap-2">
                {estimate.estimate.factors.map((factor, i) => (
                  <span
                    key={i}
                    className="text-xs bg-surface-600 text-zinc-400 px-2 py-1 rounded"
                  >
                    {factor}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-surface-500/30 flex items-center justify-between text-xs text-zinc-500">
                <span>Confidence: {estimate.estimate.confidence}</span>
                <span>{lastUpdated}</span>
              </div>
            </div>

            <div className="text-center text-xs text-zinc-600">
              Estimates are based on market data and may vary by location
            </div>
          </div>
        )}

        {/* Empty States */}
        {!loading && activeTab === 'ebay' && comps.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-50">&#128269;</div>
            <div className="text-zinc-400 mb-2">
              Search eBay, CycleTrader, Craigslist & more
            </div>
            <div className="text-xs text-zinc-600">
              Example: "2019 Can-Am Spyder RT"
            </div>
          </div>
        )}

        {!loading && activeTab === 'estimate' && !estimate && !error && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-50">&#10024;</div>
            <div className="text-zinc-400 mb-2">
              Get an AI-powered price estimate
            </div>
            <div className="text-xs text-zinc-600">
              Enter Year Make Model (e.g. "2019 Can-Am Spyder RT")
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
