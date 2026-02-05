import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { InventoryItem } from '../types/inventory';
import { getAllItems } from '../utils/db';

interface AllListingsScreenProps {
  onItemClick: (id: string) => void;
}

export default function AllListingsScreen({ onItemClick }: AllListingsScreenProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const allItems = await getAllItems();
      setItems(allItems);
      setFilteredItems(allItems);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = items.filter(
      item =>
        item.itemNumber.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.make.toLowerCase().includes(query) ||
        item.model.toLowerCase().includes(query) ||
        (item.year && item.year.toString().includes(query)) ||
        (item.location && item.location.toLowerCase().includes(query))
    );

    setFilteredItems(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading items...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">All Items</h1>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item, make, model, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div className="text-sm text-gray-600">
            Showing {filteredItems.length} of {items.length} items
          </div>
        </div>
        <div className="bg-gray-100 border-b border-gray-200">
          <div className="grid grid-cols-[auto_auto_auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Item#</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Year</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Make</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Model</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Mi/Hr</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Location</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Score</div>
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Doc Type</div>
          </div>
        </div>
      </div>

      <div className="bg-white divide-y divide-gray-200">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[auto_auto_auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onItemClick(item.id)}
          >
            <div className="text-sm text-gray-900 font-medium">{item.itemNumber}</div>
            <div className="text-sm text-gray-700">{item.year || '-'}</div>
            <div className="text-sm text-gray-900 font-medium">{item.make}</div>
            <div className="text-sm text-gray-700">{item.model}</div>
            <div className="text-sm text-gray-600">{item.milesHours || '-'}</div>
            <div className="text-sm text-gray-600">{item.location}</div>
            <div className="text-sm">
              {item.crScore !== null && (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  item.crScore >= 80 ? 'bg-green-100 text-green-800' :
                  item.crScore >= 70 ? 'bg-blue-100 text-blue-800' :
                  item.crScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {item.crScore}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600">{item.docs || '-'}</div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No results found</p>
        </div>
      )}
    </div>
  );
}
