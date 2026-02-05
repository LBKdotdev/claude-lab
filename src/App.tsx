import { useState, useEffect } from 'react';
import BottomNav from './components/BottomNav';
import ImportScreen from './screens/ImportScreen';
import AllListingsScreen from './screens/AllListingsScreen';
import ShortlistScreen from './screens/ShortlistScreen';
import FloorScreen from './screens/FloorScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import InventoryScreen from './screens/InventoryScreen';
import BuyFeeCalculatorScreen from './screens/BuyFeeCalculatorScreen';
import KittyCompsScreen from './screens/KittyCompsScreen';
import AuctionDataScreen from './screens/AuctionDataScreen';
import { initDB } from './utils/db';
import demoListings from './data/demoListings.json';

const STORAGE_KEY = 'lbk_listings';

function App() {
  const [currentTab, setCurrentTab] = useState('import');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showKittyComps, setShowKittyComps] = useState(false);
  const [showAuctionData, setShowAuctionData] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [lastImportCount, setLastImportCount] = useState(0);
  const [lastImportTime, setLastImportTime] = useState('');

  useEffect(() => {
    initDB();

    const storedItems = localStorage.getItem(STORAGE_KEY);
    const storedCount = localStorage.getItem('lbk_lastImportCount');
    const storedTime = localStorage.getItem('lbk_lastImportTime');

    if (storedItems) {
      try {
        setItems(JSON.parse(storedItems));
      } catch (e) {
        console.error('Error parsing stored items:', e);
      }
    } else {
      setItems(demoListings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoListings));
      setLastImportCount(demoListings.length);
      const timestamp = 'Demo data loaded';
      setLastImportTime(timestamp);
      localStorage.setItem('lbk_lastImportCount', String(demoListings.length));
      localStorage.setItem('lbk_lastImportTime', timestamp);
    }

    if (storedCount) {
      setLastImportCount(parseInt(storedCount, 10) || 0);
    }

    if (storedTime) {
      setLastImportTime(storedTime);
    }
  }, []);

  const handleItemClick = (id: string) => {
    setSelectedItemId(id);
  };

  const handleCloseDetail = () => {
    setSelectedItemId(null);
  };

  const handleImportSuccess = (importedItems: any[], count: number, timestamp: string) => {
    setItems(importedItems);
    setLastImportCount(count);
    setLastImportTime(timestamp);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(importedItems));
    localStorage.setItem('lbk_lastImportCount', String(count));
    localStorage.setItem('lbk_lastImportTime', timestamp);
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setItems(demoListings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoListings));
    setLastImportCount(demoListings.length);
    const timestamp = 'Demo data reset';
    setLastImportTime(timestamp);
    localStorage.setItem('lbk_lastImportCount', String(demoListings.length));
    localStorage.setItem('lbk_lastImportTime', timestamp);
  };

  const handleViewInventory = () => {
    setShowInventory(true);
  };

  const handleBackFromInventory = () => {
    setShowInventory(false);
  };

  const handleOpenCalculator = () => {
    setShowCalculator(true);
  };

  const handleBackFromCalculator = () => {
    setShowCalculator(false);
  };

  const handleOpenKittyComps = () => {
    setShowKittyComps(true);
  };

  const handleBackFromKittyComps = () => {
    setShowKittyComps(false);
  };

  const handleOpenAuctionData = () => {
    setShowAuctionData(true);
  };

  const handleBackFromAuctionData = () => {
    setShowAuctionData(false);
  };

  if (showAuctionData) {
    return <AuctionDataScreen onBack={handleBackFromAuctionData} />;
  }

  if (showKittyComps) {
    return <KittyCompsScreen onBack={handleBackFromKittyComps} />;
  }

  if (showCalculator) {
    return <BuyFeeCalculatorScreen onBack={handleBackFromCalculator} />;
  }

  if (showInventory) {
    return (
      <InventoryScreen
        items={items}
        lastImportCount={lastImportCount}
        lastImportTime={lastImportTime}
        onBack={handleBackFromInventory}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-950">
        {currentTab === 'import' && (
          <ImportScreen
            onImportSuccess={handleImportSuccess}
            onViewInventory={handleViewInventory}
            onOpenCalculator={handleOpenCalculator}
            onOpenKittyComps={handleOpenKittyComps}
            onOpenAuctionData={handleOpenAuctionData}
            onResetDemoData={handleResetDemoData}
            lastImportCount={lastImportCount}
            lastImportTime={lastImportTime}
          />
        )}
        {currentTab === 'all' && <AllListingsScreen onItemClick={handleItemClick} />}
        {currentTab === 'shortlist' && <ShortlistScreen onItemClick={handleItemClick} />}
        {currentTab === 'floor' && <FloorScreen />}
      </div>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {selectedItemId && (
        <ItemDetailScreen itemId={selectedItemId} onClose={handleCloseDetail} />
      )}
    </>
  );
}

export default App;
