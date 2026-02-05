import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Copy, Loader2, Upload } from 'lucide-react';
import type { InventoryItem, Status } from '../types/inventory';
import { getItem, saveItem } from '../utils/db';
import { getBuyFee, getTotalDue, getFeeDetails } from '../utils/buyFee';
import { generateBuddyTag } from '../utils/buddyTag';
import { parseCompsCSV, calculateCompsSummary } from '../utils/comps';
import { Comp, CompsResult } from '../types/comps';
import { runKittyCompsSearch } from '../utils/kittyCompsProvider';
import { KittyCompsSearchParams } from '../types/kittyComps';

interface ItemDetailScreenProps {
  itemId: string;
  onClose: () => void;
}

type ReportType = 'comps' | 'issues' | 'risk' | null;

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
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [compsData, setCompsData] = useState<CompsResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
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
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
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
      alert('Saved');
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
      alert(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Copy error:', error);
      alert('Failed to copy');
    }
  };

  const getFacebookMarketplaceQuery = () => {
    if (!item) return '';
    const parts = [item.year, item.make, item.model].filter(Boolean);
    return parts.join(' ');
  };

  const getEbayQuery = () => {
    if (!item) return '';
    const parts = [item.year, item.make, item.model].filter(Boolean);
    return parts.join(' ');
  };

  const handleRunComps = async () => {
    if (!item) return;
    setSayBrahLoading(true);
    setActiveReport('comps');

    await new Promise(resolve => setTimeout(resolve, 1500));

    const itemYear = item.year || 2020;
    const itemMileage = item.milesHours ? parseInt(item.milesHours) : null;

    const params: KittyCompsSearchParams = {
      zipCode: '92831',
      radiusMiles: 100,
      year: itemYear,
      make: item.make,
      model: item.model,
      mileage: itemMileage || undefined,
      condition: 'unknown',
    };

    const searchResult = runKittyCompsSearch(params);
    const result: CompsResult = {
      comps: searchResult.comps,
      summary: searchResult.summary,
    };

    setCompsData(result);
    setReportContent({ compsResult: result });
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

    await new Promise(resolve => setTimeout(resolve, 1000));

    let issues: string[] = [];
    const modelUpper = item.model.toUpperCase();

    if (modelUpper.includes('SPYDER')) {
      issues = [
        'Battery and charging',
        'Belt wear and alignment',
        'DPS/steering fault',
        'Brake wear',
        'Recalls check'
      ];
    } else if (modelUpper.includes('RYKER')) {
      issues = [
        'Belt tension',
        'Battery',
        'CVT behavior',
        'Brake pads',
        'Maintenance intervals'
      ];
    } else {
      issues = [
        'Battery',
        'Tires',
        'Brakes',
        'Service history'
      ];
    }

    setReportContent({ issues });
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
      <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center">
        <div className="text-gray-400">Item not found</div>
      </div>
    );
  }

  const buyFee = maxBid.trim() ? getBuyFee(parseFloat(maxBid)) : null;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 overflow-y-auto pb-20">
      <div className="sticky top-0 bg-gray-950 border-b border-gray-800 z-10">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-white">Item Details</h1>
          <button onClick={onClose} className="text-gray-400 p-2">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {item.photoUrl && (
          <img
            src={item.photoUrl}
            alt={item.title}
            className="w-full h-64 object-cover rounded-lg mb-4"
          />
        )}

        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {item.itemNumber && (
                  <div className="text-lime-400 font-bold text-xl">#{item.itemNumber}</div>
                )}
                {item.buddyTag && (
                  <div className="bg-lime-500/20 text-lime-400 px-2 py-1 rounded text-xs font-bold">
                    {item.buddyTag}
                  </div>
                )}
              </div>
              <div className="text-gray-400 text-xs mt-1">{item.category}</div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-white mb-4">{item.title}</h2>

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            {item.year && (
              <div>
                <div className="text-gray-400">Year</div>
                <div className="text-white font-medium">{item.year}</div>
              </div>
            )}
            {item.make && (
              <div>
                <div className="text-gray-400">Make</div>
                <div className="text-white font-medium">{item.make}</div>
              </div>
            )}
            {item.model && (
              <div>
                <div className="text-gray-400">Model</div>
                <div className="text-white font-medium">{item.model}</div>
              </div>
            )}
            {item.milesHours && (
              <div>
                <div className="text-gray-400">Miles/Hours</div>
                <div className="text-white font-medium">{item.milesHours}</div>
              </div>
            )}
            {item.docs && (
              <div>
                <div className="text-gray-400">Docs</div>
                <div className="text-lime-400 font-medium">{item.docs}</div>
              </div>
            )}
            {item.crScore !== null && (
              <div>
                <div className="text-gray-400">CR Score</div>
                <div className="text-white font-medium">{item.crScore}</div>
              </div>
            )}
          </div>

          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-lime-400 text-sm hover:text-lime-300 mb-4"
            >
              <ExternalLink size={16} />
              View Source Listing
            </a>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <h3 className="text-white font-semibold mb-4">Your Info</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Status)}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-lime-500 focus:outline-none"
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="interested">Interested</option>
                <option value="maybe">Maybe</option>
                <option value="pass">Pass</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Max Bid ($)</label>
              <input
                type="number"
                value={maxBid}
                onChange={e => setMaxBid(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-lime-500 focus:outline-none"
              />
              {buyFee !== null && (
                <div className="text-sm text-gray-400 mt-2">
                  Buy fee: <span className="text-lime-400 font-semibold">${buyFee}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Note</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add your notes..."
                rows={4}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-lime-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-lime-500 text-gray-950 py-3 rounded-lg font-semibold mt-4 active:bg-lime-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <h3 className="text-white font-semibold mb-4">Copy Comp Searches</h3>
          <div className="space-y-3">
            <button
              onClick={() =>
                copyToClipboard(getFacebookMarketplaceQuery(), 'Facebook Marketplace search')
              }
              className="w-full bg-gray-800 text-white py-3 px-4 rounded-lg flex items-center justify-between active:bg-gray-700"
            >
              <span className="text-sm">Facebook Marketplace</span>
              <Copy size={18} className="text-lime-400" />
            </button>
            <button
              onClick={() => copyToClipboard(getEbayQuery(), 'eBay search')}
              className="w-full bg-gray-800 text-white py-3 px-4 rounded-lg flex items-center justify-between active:bg-gray-700"
            >
              <span className="text-sm">eBay Sold Listings</span>
              <Copy size={18} className="text-lime-400" />
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <h2 className="text-lg font-bold text-lime-400 mb-4">Say Brah</h2>
          <div className="space-y-2">
            <button
              onClick={handleRunComps}
              disabled={sayBrahLoading}
              className="w-full bg-lime-500 text-gray-950 py-3 rounded-lg font-semibold active:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Run Comps
            </button>
            <button
              onClick={handleKnownIssues}
              disabled={sayBrahLoading}
              className="w-full bg-lime-500 text-gray-950 py-3 rounded-lg font-semibold active:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Known Issues
            </button>
            <button
              onClick={handleRiskScore}
              disabled={sayBrahLoading}
              className="w-full bg-lime-500 text-gray-950 py-3 rounded-lg font-semibold active:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Risk Score
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full bg-gray-800 text-lime-400 py-3 rounded-lg font-semibold active:bg-gray-700 flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Import Comps CSV
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {sayBrahLoading && (
          <div className="bg-gray-900 rounded-lg p-8 flex items-center justify-center mb-4">
            <Loader2 size={32} className="text-lime-400 animate-spin" />
          </div>
        )}

        {!sayBrahLoading && reportContent && activeReport === 'comps' && reportContent.compsResult && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-white font-semibold mb-4">Say Brah Report - Comps</h3>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Active Listings:</span>
                  <span className="text-lime-400 font-semibold ml-2">{reportContent.compsResult.summary.count_active}</span>
                </div>
                <div>
                  <span className="text-gray-400">Sold:</span>
                  <span className="text-gray-300 font-semibold ml-2">{reportContent.compsResult.summary.count_sold}</span>
                </div>
                <div>
                  <span className="text-gray-400">Average:</span>
                  <span className="text-white font-semibold ml-2">${reportContent.compsResult.summary.average_price.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">Median:</span>
                  <span className="text-white font-semibold ml-2">${reportContent.compsResult.summary.median_price.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">Low:</span>
                  <span className="text-green-400 font-semibold ml-2">${reportContent.compsResult.summary.low_price.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">High:</span>
                  <span className="text-red-400 font-semibold ml-2">${reportContent.compsResult.summary.high_price.toLocaleString()}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-3">
                Updated: {new Date(reportContent.compsResult.summary.last_updated).toLocaleString()}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-left text-xs text-gray-400">
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Price</th>
                    <th className="px-2 py-2">Year</th>
                    <th className="px-2 py-2">Mileage</th>
                    <th className="px-2 py-2">Distance</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Score</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {reportContent.compsResult.comps.map((comp: Comp, idx: number) => (
                    <tr key={idx} className="text-gray-300">
                      <td className="px-2 py-2">
                        <span className={`text-xs px-2 py-1 rounded ${comp.status === 'sold' ? 'bg-gray-700 text-gray-300' : 'bg-lime-900 text-lime-300'}`}>
                          {comp.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-white font-semibold">${comp.price.toLocaleString()}</td>
                      <td className="px-2 py-2">{comp.year || '-'}</td>
                      <td className="px-2 py-2">
                        {comp.mileage ? (
                          <span className={comp.mileage_quality === 'strong' ? 'text-lime-400' : comp.mileage_quality === 'weak' ? 'text-yellow-400' : ''}>
                            {comp.mileage.toLocaleString()}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-2 py-2">{comp.distance_miles ? `${comp.distance_miles} mi` : '-'}</td>
                      <td className="px-2 py-2 text-xs">{comp.source_name}</td>
                      <td className="px-2 py-2 text-xs">
                        {comp.location_city && comp.location_state ? `${comp.location_city}, ${comp.location_state}` : '-'}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`text-xs font-semibold ${comp.match_score >= 80 ? 'text-lime-400' : comp.match_score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {comp.match_score}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <a href={comp.source_url} target="_blank" rel="noopener noreferrer" className="text-lime-400 hover:text-lime-300">
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!sayBrahLoading && reportContent && activeReport === 'issues' && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-white font-semibold mb-3">Say Brah Report - Known Issues</h3>
            <ul className="space-y-2">
              {reportContent.issues.map((issue: string, idx: number) => (
                <li key={idx} className="bg-gray-800 rounded-lg p-3 text-gray-300 text-sm">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!sayBrahLoading && reportContent && activeReport === 'risk' && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-white font-semibold mb-3">Say Brah Report - Risk Score</h3>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Risk Level:</span>
                <span
                  className={`font-bold text-lg ${
                    reportContent.score === 'Low'
                      ? 'text-lime-400'
                      : reportContent.score === 'High'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }`}
                >
                  {reportContent.score}
                </span>
              </div>
              <p className="text-gray-300 text-sm mt-3">{reportContent.reason}</p>
            </div>
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Import Comps CSV</h2>
            <div className="text-gray-300 text-sm space-y-2 mb-4">
              <p>Upload a CSV file with the following columns:</p>
              <div className="bg-gray-800 p-3 rounded font-mono text-xs overflow-x-auto">
                status,price,year,make,model,trim,mileage,location_city,location_state,distance_miles,source_name,source_url,listing_date,match_score
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Required: source_name, source_url, price. Must have at least 5 valid comps.
              </p>
              <a
                href="/sample-comps.csv"
                download
                className="text-lime-400 text-xs underline hover:text-lime-300 inline-flex items-center gap-1"
              >
                Download sample CSV template
              </a>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleImportCompsCSV}
                className="flex-1 bg-lime-500 text-black py-2 rounded-lg active:bg-lime-600 font-semibold"
              >
                Choose File
              </button>
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 bg-gray-800 text-white py-2 rounded-lg active:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeeDetails && buyFee !== null && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowFeeDetails(false)}>
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Fee Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                <span className="text-gray-400">Bid Amount:</span>
                <span className="text-lime-400 font-semibold">${parseFloat(maxBid).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                <span className="text-gray-400">Buy Fee:</span>
                <span className="text-white font-semibold">${buyFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                <span className="text-gray-400 font-semibold">Total Due:</span>
                <span className="text-lime-400 font-bold text-lg">${(parseFloat(maxBid) + buyFee).toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setShowFeeDetails(false)}
              className="w-full mt-6 bg-gray-800 text-white py-2 rounded-lg active:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
