import { ArrowLeft, Calculator, X, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getFeeDetails } from '../utils/buyFee';

interface BuyFeeCalculatorScreenProps {
  onBack: () => void;
}

interface Calculation {
  bid: number;
  fee: number;
  total: number;
  timestamp: string;
}

export default function BuyFeeCalculatorScreen({ onBack }: BuyFeeCalculatorScreenProps) {
  const [bidInput, setBidInput] = useState('');
  const [location, setLocation] = useState('San Diego');
  const [result, setResult] = useState<ReturnType<typeof getFeeDetails> | null>(null);
  const [error, setError] = useState('');
  const [recentCalculations, setRecentCalculations] = useState<Calculation[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('lbk_recent_fee_calculations');
    if (stored) {
      try {
        setRecentCalculations(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing recent calculations:', e);
      }
    }
  }, []);

  useEffect(() => {
    calculateFee();
  }, [bidInput]);

  const calculateFee = () => {
    setError('');
    setResult(null);

    if (!bidInput || bidInput.trim() === '') {
      return;
    }

    const cleanedInput = bidInput.replace(/[$,]/g, '');
    const bidNum = parseFloat(cleanedInput);

    if (isNaN(bidNum)) {
      setError('Enter a valid bid price');
      return;
    }

    if (bidNum < 0) {
      setError('Enter a valid bid price');
      return;
    }

    if (bidNum > 999999) {
      setError('Bid above supported fee table');
      return;
    }

    const details = getFeeDetails(bidNum);
    if (details) {
      setResult(details);
    } else {
      setError('Unable to calculate fee');
    }
  };

  const handleClear = () => {
    setBidInput('');
    setLocation('San Diego');
    setResult(null);
    setError('');
  };

  const saveToRecent = () => {
    if (!result) return;

    const newCalculation: Calculation = {
      bid: result.bid,
      fee: result.fee,
      total: result.total,
      timestamp: new Date().toLocaleString(),
    };

    const updated = [newCalculation, ...recentCalculations].slice(0, 5);
    setRecentCalculations(updated);
    localStorage.setItem('lbk_recent_fee_calculations', JSON.stringify(updated));
  };

  const clearRecentCalculations = () => {
    if (confirm('Clear all recent calculations?')) {
      setRecentCalculations([]);
      localStorage.removeItem('lbk_recent_fee_calculations');
    }
  };

  useEffect(() => {
    if (result && bidInput) {
      saveToRecent();
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      <div className="bg-gray-900 p-4 flex items-center gap-3 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 active:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">Buy Fee Calculator</h1>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="bg-gray-900 rounded-lg p-5">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Bid Price *</label>
              <input
                type="text"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                className="w-full bg-gray-800 text-white text-lg px-4 py-3 rounded-lg border border-gray-700 focus:border-lime-400 focus:outline-none"
                placeholder="$5,000"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-lime-400 focus:outline-none"
                placeholder="San Diego"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={calculateFee}
                className="bg-lime-500 text-black py-3 rounded-lg font-semibold active:bg-lime-600 flex items-center justify-center gap-2"
              >
                <Calculator size={18} />
                Calculate
              </button>
              <button
                onClick={handleClear}
                className="bg-gray-800 text-white py-3 rounded-lg font-semibold active:bg-gray-700 flex items-center justify-center gap-2"
              >
                <X size={18} />
                Clear
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
            <div className="text-red-400 font-medium">{error}</div>
          </div>
        )}

        {result && !error && (
          <div className="bg-gray-900 rounded-lg p-5">
            <h2 className="text-lime-400 font-semibold text-lg mb-4">Results</h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-gray-800">
                <span className="text-gray-400">Bid Price:</span>
                <span className="text-white font-semibold text-lg">
                  ${result.bid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-gray-800">
                <span className="text-gray-400">Buy Fee:</span>
                <span className="text-white font-semibold text-lg">
                  ${result.fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-gray-800">
                <span className="text-gray-400 font-semibold">Total Out-the-Door:</span>
                <span className="text-lime-400 font-bold text-2xl">
                  ${result.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Fee Bracket Used:</div>
                <div className="text-gray-300 font-medium">
                  ${result.range} → ${result.fee.toLocaleString()}
                </div>
              </div>

              {location && (
                <div className="pt-2">
                  <div className="text-xs text-gray-400">Location: {location}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {recentCalculations.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Recent Calculations</h3>
              <button
                onClick={clearRecentCalculations}
                className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {recentCalculations.map((calc, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-750"
                  onClick={() => setBidInput(calc.bid.toString())}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">
                          ${calc.bid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-gray-500">+</span>
                        <span className="text-gray-400">
                          ${calc.fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-gray-500">=</span>
                        <span className="text-lime-400 font-semibold">
                          ${calc.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{calc.timestamp}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
