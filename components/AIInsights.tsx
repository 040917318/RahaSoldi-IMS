import React, { useState } from 'react';
import { InventoryItem, SaleRecord } from '../types';
import { generateBusinessInsights } from '../services/geminiService';
import { Brain, Sparkles, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIInsightsProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
}

export const AIInsights: React.FC<AIInsightsProps> = ({ inventory, sales }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await generateBusinessInsights(inventory, sales);
    setAnalysis(result);
    setLoading(false);
  };

  // Safe markdown render component in case we want to use it, though simple text is fine.
  // We will assume the response is simple markdown.

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
          Our AI analyzes your data to suggest restocking strategies and highlight your best performers.
        </p>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-lg shadow-md hover:bg-indigo-50 transition-all flex items-center disabled:opacity-70 disabled:cursor-wait"
        >
          {loading ? (
            <>
              <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
              Analyzing Data...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Business Report
            </>
          )}
        </button>
      </div>

      {analysis && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
            <span className="w-2 h-8 bg-indigo-500 rounded-full mr-3"></span>
            Analysis Result
          </h3>
          <div className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-strong:text-indigo-700">
             {/* Simple whitespace rendering if markdown is complex, but basic markdown works well */}
             <div className="whitespace-pre-wrap font-medium text-slate-700 leading-7">
               {analysis}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};