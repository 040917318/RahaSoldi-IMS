import React, { useState } from 'react';
import { InventoryItem, SaleRecord } from '../types';
import { generateBusinessInsights } from '../services/geminiService';
import { Brain, Sparkles, RefreshCcw, Calendar, MessageSquare, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIInsightsProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
}

type TimeRange = '7days' | '30days' | '90days' | 'all' | 'custom';

export const AIInsights: React.FC<AIInsightsProps> = ({ inventory, sales }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const now = new Date();

    switch (timeRange) {
        case '7days':
            startDate = new Date();
            startDate.setDate(now.getDate() - 7);
            endDate = now;
            break;
        case '30days':
            startDate = new Date();
            startDate.setDate(now.getDate() - 30);
            endDate = now;
            break;
        case '90days':
            startDate = new Date();
            startDate.setDate(now.getDate() - 90);
            endDate = now;
            break;
        case 'custom':
            if (customStart) startDate = new Date(customStart);
            if (customEnd) endDate = new Date(customEnd);
            break;
        case 'all':
        default:
            startDate = undefined;
            endDate = undefined;
            break;
    }

    const result = await generateBusinessInsights(inventory, sales, startDate, endDate, customQuestion);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Raha Soldi Intelligence</h2>
            <p className="text-indigo-100 opacity-90">Powered by Google Gemini AI</p>
          </div>
        </div>
        
        <p className="mb-6 text-indigo-50 leading-relaxed max-w-2xl">
          Get real-time insights into your inventory health, sales trends, and profitability. 
          Customize the analysis period or ask specific questions to get deeper answers.
        </p>
      </div>

       {/* Configuration Panel */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
             <Clock className="w-5 h-5 mr-2 text-indigo-600" />
             Analysis Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Time Range */}
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" /> Time Period
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {(['7days', '30days', '90days', 'all'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setTimeRange(r)}
                            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${
                                timeRange === r 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {r === 'all' ? 'All Time' : `Last ${r.replace('days', ' Days')}`}
                        </button>
                    ))}
                     <button
                        onClick={() => setTimeRange('custom')}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${
                            timeRange === 'custom'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Custom Range
                    </button>
                </div>
                
                {timeRange === 'custom' && (
                    <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <input 
                            type="date" 
                            className="text-sm border-slate-300 rounded-md p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                            value={customStart}
                            onChange={e => setCustomStart(e.target.value)}
                        />
                        <span className="text-slate-400">-</span>
                        <input 
                            type="date" 
                            className="text-sm border-slate-300 rounded-md p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                            value={customEnd}
                            onChange={e => setCustomEnd(e.target.value)}
                        />
                    </div>
                )}
             </div>

             {/* Custom Question */}
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1" /> Specific Question (Optional)
                </label>
                <textarea
                    className="w-full bg-blue-50 border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-3 border"
                    rows={3}
                    placeholder="e.g., Which product category has the highest profit margin? or Why are sales low this week?"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                />
             </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
             <button
                onClick={handleAnalyze}
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all flex items-center disabled:opacity-70 disabled:cursor-wait"
             >
                {loading ? (
                    <>
                    <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Data...
                    </>
                ) : (
                    <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Insights
                    </>
                )}
             </button>
          </div>
       </div>

      {analysis && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
            <span className="w-2 h-8 bg-indigo-500 rounded-full mr-3"></span>
            Analysis Result
          </h3>
          <div className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-strong:text-indigo-700 prose-li:text-slate-600">
             <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};