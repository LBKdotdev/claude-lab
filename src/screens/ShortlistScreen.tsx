import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { InventoryItem, Status } from '../types/inventory';
import { getAllItems, saveItem, deleteItem } from '../utils/db';
import { generateBuddyTag } from '../utils/buddyTag';
import ItemRow from '../components/ItemRow';

interface ShortlistScreenProps {
  onItemClick: (id: string) => void;
}

export default function ShortlistScreen({ onItemClick }: ShortlistScreenProps) {
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
      const shortlist = allItems.filter(
        item => item.status === 'interested' || item.status === 'maybe'
      );
      setItems(shortlist);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        item =>
          item.itemNumber.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query) ||
          item.make.toLowerCase().includes(query) ||
          item.model.toLowerCase().includes(query) ||
          (item.year && item.year.toString().includes(query))
      );
    }

    filtered.sort((a, b) => {
      if (a.status === 'interested' && b.status !== 'interested') return -1;
      if (a.status !== 'interested' && b.status === 'interested') return 1;
      return b.updatedAt - a.updatedAt;
    });

    setFilteredItems(filtered);
  };

  const handleStatusChange = async (id: string, status: Status) => {
    try {
      const item = items.find(i => i.id === id);
      if (!item) return;

      let buddyTag = item.buddyTag;
      if ((status === 'interested' || status === 'maybe') && !buddyTag) {
        buddyTag = generateBuddyTag();
      }

      const updated = { ...item, status, buddyTag, updatedAt: Date.now() };
      await saveItem(updated);

      if (status === 'interested' || status === 'maybe') {
        setItems(prev => prev.map(i => (i.id === id ? updated : i)));
      } else {
        setItems(prev => prev.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('FY Couch?')) {
      try {
        await deleteItem(id);
        setItems(prev => prev.filter(i => i.id !== id));
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const interestedCount = items.filter(i => i.status === 'interested').length;
  const maybeCount = items.filter(i => i.status === 'maybe').length;

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <div className="sticky top-0 bg-gray-950 border-b border-gray-800 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-white">Shortlist</h1>
            <div className="flex gap-3 text-sm">
              <span className="text-lime-400">{interestedCount} Interested</span>
              <span className="text-yellow-400">{maybeCount} Maybe</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search item #, title, make, model, year..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 text-white pl-11 pr-4 py-3 rounded-lg border border-gray-700 focus:border-lime-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            {searchQuery ? 'No items match your search' : 'No items in shortlist yet'}
          </div>
        ) : (
          filteredItems.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onClick={onItemClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
