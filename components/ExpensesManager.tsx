
import React, { useState, useMemo } from 'react';
import { ExpenseRecord } from '../types';
import { Plus, Search, Calendar, Tag, Download, Filter, TrendingUp, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface ExpensesManagerProps {
  expenses: ExpenseRecord[];
  onAdd: (expense: Omit<ExpenseRecord, 'id' | 'recordedAt'>) => void;
  currencySymbol: string;
}

// Custom Cedi Icon Component
const CediSign = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M16 7a6 6 0 1 0 0 10" />
    <path d="M10 3v18" />
  </svg>
);

export const ExpensesManager: React.FC<ExpensesManagerProps> = ({ expenses, onAdd, currencySymbol }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other'];
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  // 1. Filter Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            exp.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || exp.category === selectedCategory;

      let matchesDate = true;
      if (startDate) {
         matchesDate = matchesDate && new Date(exp.date) >= new Date(startDate);
      }
      if (endDate) {
         matchesDate = matchesDate && new Date(exp.date) <= new Date(endDate);
      }

      return matchesSearch && matchesCategory && matchesDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, searchTerm, startDate, endDate, selectedCategory]);

  // 2. Aggregate Data for Charts
  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      data[exp.category] = (data[exp.category] || 0) + exp.amount;
    });
    return Object.keys(data).map(key => ({ name: key, value: data[key] }));
  }, [filteredExpenses]);

  const dailyData = useMemo(() => {
    // Show last 7 entries or grouped by day if too many, simplified here to recent individual expenses for bar chart
    // A better approach for bar chart is aggregating by day
    const data: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
        const dateKey = new Date(exp.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
        data[dateKey] = (data[dateKey] || 0) + exp.amount;
    });
    // Take last 7 days present in data for cleanliness
    return Object.keys(data).slice(0, 7).map(key => ({ date: key, amount: data[key] }));
  }, [filteredExpenses]);

  // 3. Metrics
  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);
  const avgExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;
  const topCategory = categoryData.length > 0 ? categoryData.reduce((prev, current) => (prev.value > current.value) ? prev : current).name : 'N/A';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.category) return;

    onAdd({
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date
    });

    setFormData({
      description: '',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsFormOpen(false);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'ID'];
    const rows = filteredExpenses.map(e => [
        e.date,
        `"${e.description.replace(/"/g, '""')}"`, // Escape quotes
        e.category,
        e.amount.toFixed(2),
        e.id
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expenses_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Metrics & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metrics Column */}
        <div className="space-y-4">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">Total Expenses</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{currencySymbol}{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                    <CediSign className="w-6 h-6 text-red-600" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">Avg. Transaction</p>
                    <h3 className="text-xl font-bold text-slate-800 mt-1">{currencySymbol}{avgExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
            </div>

             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">Highest Category</p>
                    <h3 className="text-xl font-bold text-slate-800 mt-1 truncate max-w-[150px]">{topCategory}</h3>
                </div>
                <div className="p-3 bg-indigo-100 rounded-lg">
                    <PieIcon className="w-6 h-6 text-indigo-600" />
                </div>
            </div>
        </div>

        {/* Breakdown Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1">
             <h3 className="text-sm font-bold text-slate-700 mb-4">Category Breakdown</h3>
             <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${currencySymbol}${value.toLocaleString()}`} />
                        <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '10px'}} />
                    </PieChart>
                </ResponsiveContainer>
             </div>
        </div>

         {/* Daily Trend Chart */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 hidden lg:block">
             <h3 className="text-sm font-bold text-slate-700 mb-4">Daily Trend (Recent)</h3>
             <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                            cursor={{fill: '#f1f5f9'}}
                            formatter={(value: number) => [`${currencySymbol}${value}`, 'Amount']}
                        />
                        <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 items-end lg:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-2 w-full lg:w-auto">
                 {/* Search */}
                <div className="relative w-full md:w-48">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="block w-full md:w-36 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <div className="flex gap-2">
                    <input
                        type="date"
                        className="block w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        placeholder="Start Date"
                    />
                    <input
                        type="date"
                        className="block w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="End Date"
                    />
                </div>
                 
                {(searchTerm || startDate || endDate || selectedCategory !== 'All') && (
                     <button 
                        onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setSelectedCategory('All'); }}
                        className="text-red-500 hover:text-red-700 text-xs font-medium px-2"
                    >
                        Reset
                    </button>
                )}
            </div>

            <div className="flex gap-3 w-full lg:w-auto">
                <button
                    onClick={handleExportCSV}
                    disabled={filteredExpenses.length === 0}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none shadow-sm disabled:opacity-50"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </button>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-800 focus:outline-none shadow-sm transition-all"
                >
                    {isFormOpen ? 'Close' : 'Add Expense'}
                    {!isFormOpen && <Plus className="h-4 w-4 ml-2" />}
                </button>
            </div>
      </div>

      {/* Add Expense Form */}
      {isFormOpen && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fade-in shadow-inner">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-primary" /> Record New Expense
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Tag className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            required
                            className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary"
                            placeholder="e.g. Shop Rent for March"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 font-bold">{currencySymbol}</span>
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            className="block w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary"
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                        required
                        className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <div className="relative">
                        <input
                            type="date"
                            required
                            className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary"
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                        />
                    </div>
                </div>
                <div className="lg:col-span-5 flex justify-end mt-2">
                    <button type="submit" className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-sm transition-colors">
                        Save Record
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {new Date(expense.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                            {expense.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                {expense.category}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600">
                            -{currencySymbol}{expense.amount.toFixed(2)}
                        </td>
                    </tr>
                ))}
                {filteredExpenses.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center">
                                <Filter className="w-8 h-8 text-slate-300 mb-2" />
                                <p>No expenses found matching current filters.</p>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};
