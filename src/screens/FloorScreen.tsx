import { useState, useRef, useEffect } from 'react';
import { Search, ThumbsUp, HelpCircle, ThumbsDown, Trash2, ExternalLink } from 'lucide-react';
import type { InventoryItem, Status } from '../types/inventory';
import { getAllItems, saveItem, deleteItem } from '../utils/db';
import { getBuyFee } from '../utils/buyFee';
import { generateBuddyTag } from '../utils/buddyTag';

export default function FloorScreen() {
  const [searchInput, setSearchInput] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [matchingItems, setMatchingItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;

    setLoading(true);
    setNotFound(false);
    setItem(null);
    setMatchingItems([]);

    try {
      const allItems = await getAllItems();
      const query = searchInput.trim().toLowerCase();

      const exactMatch = allItems.find(i =>
        i.itemNumber === searchInput.trim() ||
        (i.buddyTag && i.buddyTag.toLowerCase() === query)
      );

      if (exactMatch) {
        setItem(exactMatch);
        setNotFound(false);
      } else {
        const matches = allItems.filter(i =>
          i.title.toLowerCase().includes(query) ||
          i.make.toLowerCase().includes(query) ||
          i.model.toLowerCase().includes(query) ||
          (i.year && i.year.toString().includes(query))
        );

        if (matches.length === 1) {
          setItem(matches[0]);
          setNotFound(false);
        } else if (matches.length > 1) {
          setMatchingItems(matches);
          setNotFound(false);
        } else {
          setItem(null);
          setMatchingItems([]);
          setNotFound(true);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setItem(null);
      setMatchingItems([]);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (selectedItem: InventoryItem) => {
    setItem(selectedItem);
    setMatchingItems([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleStatusChange = async (status: Status) => {
    if (!item) return;

    try {
      let buddyTag = item.buddyTag;
      if ((status === 'interested' || status === 'maybe') && !buddyTag) {
        buddyTag = generateBuddyTag();
      }

      const updated = { ...item, status, buddyTag, updatedAt: Date.now() };
      await saveItem(updated);
      setItem(updated);
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  const handleDelete = async () => {
    if (!item || !confirm('FY Couch?')) return;

    try {
      await deleteItem(item.id);
      setItem(null);
      setSearchInput('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const getStatusLabel = (status: Status) => {
    switch (status) {
      case 'interested':
        return { text: 'Interested', color: 'text-lime-400' };
      case 'maybe':
        return { text: 'Maybe', color: 'text-yellow-400' };
      case 'pass':
        return { text: 'Pass', color: 'text-red-400' };
      default:
        return { text: 'Unreviewed', color: 'text-gray-400' };
    }
  };

  const buyFee = item?.maxBid ? getBuyFee(item.maxBid) : null;

  return (
    <div className="min-h-screen bg-gray-950 pb-20 px-4">
      <div className="max-w-2xl mx-auto pt-8">
        <h1 className="text-2xl font-bold text-white mb-6">Floor Mode</h1>

        <div className="mb-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Item #, Buddy Tag, or keyword..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full bg-gray-900 text-white text-2xl px-6 py-4 rounded-lg border-2 border-gray-700 focus:border-lime-500 focus:outline-none font-bold"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchInput.trim()}
            className="w-full mt-3 bg-lime-500 text-gray-950 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search size={20} />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {notFound && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <div className="text-red-400 text-lg font-semibold">Item not found</div>
            <div className="text-gray-400 text-sm mt-1">No match for "{searchInput}"</div>
          </div>
        )}

        {matchingItems.length > 0 && (
          <div className="space-y-2">
            <div className="text-white text-sm mb-3">
              Found {matchingItems.length} items - Select one:
            </div>
            {matchingItems.map((matchItem) => (
              <button
                key={matchItem.id}
                onClick={() => handleSelectItem(matchItem)}
                className="w-full bg-gray-900 border-2 border-gray-700 hover:border-lime-500 rounded-lg p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {matchItem.itemNumber && (
                        <div className="text-lime-400 font-bold">#{matchItem.itemNumber}</div>
                      )}
                      {matchItem.buddyTag && (
                        <div className="bg-lime-500/20 text-lime-400 px-2 py-0.5 rounded text-xs font-bold">
                          {matchItem.buddyTag}
                        </div>
                      )}
                      <div className={`text-xs font-medium ml-auto ${getStatusLabel(matchItem.status).color}`}>
                        {getStatusLabel(matchItem.status).text}
                      </div>
                    </div>
                    <div className="text-white font-medium mb-1">{matchItem.title}</div>
                    <div className="text-gray-400 text-sm">
                      {matchItem.year && `${matchItem.year} `}
                      {matchItem.make} {matchItem.model}
                    </div>
                    {matchItem.maxBid !== null && (
                      <div className="text-lime-400 text-sm font-bold mt-2">
                        Max Bid: ${matchItem.maxBid.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {matchItem.photoUrl && (
                    <img
                      src={matchItem.photoUrl}
                      alt={matchItem.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {item && (
          <div className="bg-gray-900 rounded-lg border-2 border-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {item.itemNumber && (
                      <div className="text-lime-400 font-bold text-2xl">#{item.itemNumber}</div>
                    )}
                    {item.buddyTag && (
                      <div className="bg-lime-500/20 text-lime-400 px-3 py-1 rounded text-sm font-bold">
                        {item.buddyTag}
                      </div>
                    )}
                  </div>
                  <div className={`text-sm font-medium ${getStatusLabel(item.status).color}`}>
                    {getStatusLabel(item.status).text}
                  </div>
                </div>
                {item.photoUrl && (
                  <img
                    src={item.photoUrl}
                    alt={item.title}
                    className="w-24 h-24 object-cover rounded"
                  />
                )}
              </div>

              <h2 className="text-xl font-semibold text-white mb-4">{item.title}</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {item.maxBid !== null && (
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Max Bid</div>
                    <div className="text-lime-400 font-bold text-2xl">
                      ${item.maxBid.toLocaleString()}
                    </div>
                  </div>
                )}
                {buyFee !== null && (
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Buy Fee</div>
                    <div className="text-white font-bold text-2xl">${buyFee}</div>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                {item.docs && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 min-w-20">Docs:</span>
                    <span className="text-lime-400 font-medium">{item.docs}</span>
                  </div>
                )}
                {item.crScore !== null && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 min-w-20">CR Score:</span>
                    <span className="text-white font-medium">{item.crScore}</span>
                  </div>
                )}
                {item.milesHours && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 min-w-20">Miles/Hours:</span>
                    <span className="text-white">{item.milesHours}</span>
                  </div>
                )}
                {item.note && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 min-w-20">Note:</span>
                    <span className="text-white">{item.note}</span>
                  </div>
                )}
              </div>

              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-lime-400 text-sm hover:text-lime-300"
                >
                  <ExternalLink size={16} />
                  View Source
                </a>
              )}
            </div>

            <div className="flex border-t border-gray-700">
              <button
                onClick={() => handleStatusChange('interested')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 transition-colors ${
                  item.status === 'interested'
                    ? 'bg-lime-500/20 text-lime-400'
                    : 'text-gray-400'
                }`}
              >
                <ThumbsUp size={20} />
                <span className="text-sm font-medium">Interested</span>
              </button>
              <div className="w-px bg-gray-700" />
              <button
                onClick={() => handleStatusChange('maybe')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 transition-colors ${
                  item.status === 'maybe' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400'
                }`}
              >
                <HelpCircle size={20} />
                <span className="text-sm font-medium">Maybe</span>
              </button>
              <div className="w-px bg-gray-700" />
              <button
                onClick={() => handleStatusChange('pass')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 transition-colors ${
                  item.status === 'pass' ? 'bg-red-500/20 text-red-400' : 'text-gray-400'
                }`}
              >
                <ThumbsDown size={20} />
                <span className="text-sm font-medium">Pass</span>
              </button>
              <div className="w-px bg-gray-700" />
              <button
                onClick={handleDelete}
                className="px-6 py-4 flex items-center justify-center text-red-400"
                title="FY Couch"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
