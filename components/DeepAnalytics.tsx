import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, SaleRecord } from '../types';
import { Search, Network, Zap, Activity, Filter, Maximize2, Share2, Target, Clock, AlertTriangle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DeepAnalyticsProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  currencySymbol: string;
}

// Graph Types
interface Node {
  id: string;
  label: string;
  type: 'category' | 'product' | 'sale';
  value: number; // For sizing
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  data?: any;
}

interface Link {
  source: string;
  target: string;
  value: number;
}

export const DeepAnalytics: React.FC<DeepAnalyticsProps> = ({ inventory, sales, currencySymbol }) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- SIGNAL DETECTION ---
  const signals = useMemo(() => {
    const alerts: { id: string; type: 'critical' | 'warning' | 'info'; message: string; timestamp: string }[] = [];
    
    // 1. High Discount Anomaly
    sales.forEach(sale => {
      const discountRatio = sale.items.reduce((acc, i) => acc + (i.discount || 0), 0) / (sale.totalAmount + 1); // +1 to avoid div0
      if (discountRatio > 0.25) {
        alerts.push({
          id: sale.id,
          type: 'warning',
          message: `High Discount detected (${(discountRatio * 100).toFixed(0)}%) on Sale ${sale.id.slice(-6)}`,
          timestamp: sale.timestamp
        });
      }
    });

    // 2. Stock Rapid Depletion (Mock logic: Low stock items that are selling fast)
    inventory.forEach(item => {
      if (item.quantity <= item.lowStockThreshold && item.quantity > 0) {
        alerts.push({
          id: item.id,
          type: 'critical',
          message: `Critical Stock Level: ${item.name} (${item.quantity} remaining)`,
          timestamp: new Date().toISOString()
        });
      }
    });

    return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
  }, [sales, inventory]);

  // --- KNOWLEDGE GRAPH ENGINE ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

  // Initialize Graph Data
  useEffect(() => {
    const newNodes: Node[] = [];
    const newLinks: Link[] = [];
    
    // 1. Category Nodes (Hubs)
    const categories = Array.from(new Set(inventory.map(i => i.category)));
    categories.forEach(cat => {
      newNodes.push({ id: `cat-${cat}`, label: String(cat), type: 'category', value: 20 });
    });

    // 2. Product Nodes
    // Limit to top 50 items by value to keep graph performant
    const topItems = [...inventory].sort((a, b) => (b.salesPrice * b.quantity) - (a.salesPrice * a.quantity)).slice(0, 50);
    topItems.forEach(item => {
      newNodes.push({ id: item.id, label: item.name, type: 'product', value: 10, data: item });
      // Link to Category
      newLinks.push({ source: item.id, target: `cat-${item.category}`, value: 1 });
    });

    // 3. Recent Big Sales (Context)
    // Find sales > avg value
    const avgSale = sales.reduce((acc, s) => acc + s.totalAmount, 0) / (sales.length || 1);
    const bigSales = sales.filter(s => s.totalAmount > avgSale * 1.5).slice(0, 10); // Top 10 recent big sales
    
    bigSales.forEach(sale => {
      newNodes.push({ id: sale.id, label: `Sale ${currencySymbol}${sale.totalAmount.toFixed(0)}`, type: 'sale', value: 15, data: sale });
      // Link Sale to Items involved
      sale.items.forEach(saleItem => {
        // Only link if item node exists in our graph
        if (newNodes.find(n => n.id === saleItem.itemId)) {
           newLinks.push({ source: sale.id, target: saleItem.itemId, value: 2 });
        }
      });
    });

    setNodes(newNodes.map(n => ({...n, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0})));
    setLinks(newLinks);
  }, [inventory, sales, currencySymbol]);

  // Force Directed Simulation (Custom Implementation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const simulate = () => {
      const width = canvas.width;
      const height = canvas.height;
      const center = { x: width / 2, y: height / 2 };

      // Physics Constants
      const k = 0.05; // Spring constant
      const repulsion = 500;
      const damping = 0.9;

      // 1. Apply Forces
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.x || !node.y) continue;

        let fx = 0, fy = 0;

        // Repulsion (Coulomb's Law-ish)
        for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
            const other = nodes[j];
            const dx = node.x! - other.x!;
            const dy = node.y! - other.y!;
            const distSq = dx * dx + dy * dy;
            if (distSq > 0.1) {
                const force = repulsion / Math.sqrt(distSq);
                fx += (dx / Math.sqrt(distSq)) * force;
                fy += (dy / Math.sqrt(distSq)) * force;
            }
        }

        // Attraction (Springs)
        links.forEach(link => {
             // Find source and target objects (React state might have raw IDs, need to map)
             // Simplified: assumes indices or direct matching logic isn't needed if we loop links and find nodes
             // Optimization: Map links to indices once, but for < 100 nodes, find is okay
             const sourceNode = nodes.find(n => n.id === link.source);
             const targetNode = nodes.find(n => n.id === link.target);
             
             if (sourceNode && targetNode && sourceNode.id === node.id) {
                 const dx = targetNode.x! - node.x!;
                 const dy = targetNode.y! - node.y!;
                 fx += dx * k;
                 fy += dy * k;
             }
             if (sourceNode && targetNode && targetNode.id === node.id) {
                 const dx = sourceNode.x! - node.x!;
                 const dy = sourceNode.y! - node.y!;
                 fx += dx * k;
                 fy += dy * k;
             }
        });

        // Center Gravity
        fx += (center.x - node.x!) * 0.015;
        fy += (center.y - node.y!) * 0.015;

        // Update Velocity & Position
        node.vx = (node.vx || 0) + fx * 0.05;
        node.vy = (node.vy || 0) + fy * 0.05;
        node.vx *= damping;
        node.vy *= damping;

        node.x! += node.vx;
        node.y! += node.vy;
      }

      // 2. Render
      ctx.clearRect(0, 0, width, height);
      
      // Draw Links
      ctx.strokeStyle = '#334155'; // Slate 700
      ctx.lineWidth = 1;
      links.forEach(link => {
          const s = nodes.find(n => n.id === link.source);
          const t = nodes.find(n => n.id === link.target);
          if (s && t) {
              ctx.beginPath();
              ctx.moveTo(s.x!, s.y!);
              ctx.lineTo(t.x!, t.y!);
              ctx.stroke();
          }
      });

      // Draw Nodes
      nodes.forEach(node => {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, node.value * 0.8, 0, 2 * Math.PI);
          
          // Style based on type
          if (node.type === 'category') {
              ctx.fillStyle = '#0ea5e9'; // Sky Blue
              ctx.shadowColor = '#0ea5e9';
          } else if (node.type === 'product') {
              ctx.fillStyle = '#10b981'; // Emerald
              ctx.shadowColor = '#10b981';
          } else {
              ctx.fillStyle = '#f59e0b'; // Amber
              ctx.shadowColor = '#f59e0b';
          }

          // Glow effect for "War Room" feel
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0; // Reset

          // Label (Conditional - only if large or selected)
          if (node.value > 12 || node === selectedNode) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px monospace';
            ctx.fillText(node.label, node.x! + 12, node.y! + 4);
          }
          
          // Selection Highlight
          if (node === selectedNode) {
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
          }
      });

      animationFrameId = requestAnimationFrame(simulate);
    };

    simulate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, links, selectedNode]);

  // Handle Canvas Click for Selection
  const handleCanvasClick = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Find clicked node
      const clicked = nodes.find(node => {
          const dx = node.x! - x;
          const dy = node.y! - y;
          return Math.sqrt(dx*dx + dy*dy) < node.value + 5;
      });

      setSelectedNode(clicked || null);
  };

  // --- HEATMAP DATA ---
  const heatmapData = useMemo(() => {
    // 7x24 Grid. Days 0-6, Hours 0-23.
    const grid: { day: number; hour: number; count: number }[] = [];
    for(let d=0; d<7; d++) {
        for(let h=0; h<24; h++) {
            grid.push({ day: d, hour: h, count: 0 });
        }
    }

    sales.forEach(sale => {
        const date = new Date(sale.timestamp);
        const day = date.getDay();
        const hour = date.getHours();
        const cell = grid.find(c => c.day === day && c.hour === hour);
        if (cell) cell.count += sale.totalAmount; // Weight by volume
    });
    
    // Normalize for chart bubble size
    return grid.map(g => ({ ...g, dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][g.day] }));
  }, [sales]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 text-slate-200 font-mono overflow-hidden flex flex-col">
       {/* Top Bar */}
       <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center space-x-3">
             <div className="p-2 bg-blue-500/10 rounded border border-blue-500/50">
                 <Target className="w-5 h-5 text-blue-400" />
             </div>
             <div>
                <h1 className="text-lg font-bold tracking-wider text-slate-100">DEEP ANALYTICS</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Raha Soldi Intelligence</p>
             </div>
          </div>

          <div className="flex-1 max-w-xl mx-8 relative group">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
             <input 
                type="text" 
                placeholder="Search entities, transaction IDs, or SKU codes..." 
                className="w-full bg-slate-900 border border-slate-700 rounded-sm py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600 text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          <div className="flex items-center space-x-4 text-xs">
             <div className="flex items-center text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                SYSTEM ONLINE
             </div>
             <div className="text-slate-500">
                {new Date().toLocaleTimeString()}
             </div>
          </div>
       </div>

       {/* Main Workspace */}
       <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Signal Feed */}
          <div className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col">
             <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <Activity className="w-4 h-4 mr-2" /> Signals
                </h3>
                <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30">{signals.length} Active</span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {signals.map((signal, idx) => (
                    <div key={idx} className={`p-3 rounded border text-xs relative overflow-hidden transition-all hover:bg-slate-800 ${signal.type === 'critical' ? 'bg-red-950/30 border-red-900/50' : 'bg-amber-950/20 border-amber-900/30'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${signal.type === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                        <div className="flex justify-between items-start mb-1 pl-2">
                             <span className={`font-bold ${signal.type === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                                {signal.type.toUpperCase()}
                             </span>
                             <span className="text-slate-600">{new Date(signal.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="pl-2 text-slate-400 leading-relaxed">
                            {signal.message}
                        </p>
                    </div>
                ))}
                {signals.length === 0 && (
                    <div className="text-center py-10 text-slate-600 text-sm">
                        No active anomalies detected.
                    </div>
                )}
             </div>
          </div>

          {/* Center Panel: Visualization */}
          <div className="flex-1 relative bg-slate-950 flex flex-col">
             {/* Graph Controls overlay */}
             <div className="absolute top-4 left-4 z-10 flex space-x-2">
                 <button className="p-2 bg-slate-900 border border-slate-700 rounded text-slate-400 hover:text-white hover:border-slate-500">
                     <Network className="w-4 h-4" />
                 </button>
                 <button className="p-2 bg-slate-900 border border-slate-700 rounded text-slate-400 hover:text-white hover:border-slate-500">
                     <Share2 className="w-4 h-4" />
                 </button>
             </div>

             {/* Canvas Container */}
             <div className="flex-1 overflow-hidden relative">
                 <canvas 
                    ref={canvasRef} 
                    width={800} 
                    height={600} 
                    className="w-full h-full cursor-crosshair"
                    onClick={handleCanvasClick}
                 />
                 
                 {/* Empty State / Legend */}
                 <div className="absolute bottom-4 left-4 pointer-events-none">
                     <div className="flex items-center space-x-4 text-[10px] text-slate-500">
                         <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-sky-500 mr-1 shadow shadow-sky-500"></span> Category</div>
                         <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 shadow shadow-emerald-500"></span> Product</div>
                         <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1 shadow shadow-amber-500"></span> Sale</div>
                     </div>
                 </div>
             </div>

             {/* Bottom Panel: Temporal Analysis (Heatmap) */}
             <div className="h-64 border-t border-slate-800 bg-slate-900/50 p-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Clock className="w-4 h-4 mr-2" /> Temporal Distribution (Volume by Hour/Day)
                 </h3>
                 <div className="w-full h-full pb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                        >
                            <XAxis 
                                type="number" 
                                dataKey="hour" 
                                name="Hour" 
                                domain={[0, 23]} 
                                tickCount={24} 
                                tick={{fontSize: 10, fill: '#475569'}} 
                                tickLine={false}
                                axisLine={{stroke: '#334155'}}
                            />
                            <YAxis 
                                type="category" 
                                dataKey="dayName" 
                                name="Day" 
                                allowDuplicatedCategory={false} 
                                tick={{fontSize: 10, fill: '#475569'}}
                                tickLine={false}
                                axisLine={{stroke: '#334155'}}
                            />
                            <ZAxis type="number" dataKey="count" range={[0, 400]} />
                            <Tooltip 
                                cursor={{ strokeDasharray: '3 3' }} 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0', fontSize: '12px' }}
                                itemStyle={{ color: '#94a3b8' }}
                                formatter={(value: any, name: any) => [name === 'count' ? `${currencySymbol}${value}` : value, name === 'count' ? 'Volume' : name]}
                            />
                            <Scatter name="Sales" data={heatmapData} shape="circle">
                                {heatmapData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`rgba(14, 165, 233, ${Math.min(0.8, Math.max(0.2, entry.count / 1000))})`} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                 </div>
             </div>
          </div>

          {/* Right Panel: Object Inspector */}
          <div className="w-80 border-l border-slate-800 bg-slate-900/30 flex flex-col">
             <div className="p-4 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <Maximize2 className="w-4 h-4 mr-2" /> Entity Inspector
                </h3>
             </div>
             
             <div className="p-6 flex-1 overflow-y-auto">
                 {selectedNode ? (
                     <div className="space-y-6 animate-fade-in">
                         <div className="flex items-start justify-between">
                            <div>
                                <div className="text-[10px] uppercase text-blue-500 font-bold mb-1 tracking-wider">{selectedNode.type}</div>
                                <h2 className="text-xl font-bold text-white leading-tight">{selectedNode.label}</h2>
                                <div className="text-slate-500 text-xs mt-1 font-mono">{selectedNode.id}</div>
                            </div>
                            {/* Icon based on type */}
                            <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                                {selectedNode.type === 'category' && <Network className="w-6 h-6 text-sky-500" />}
                                {selectedNode.type === 'product' && <Target className="w-6 h-6 text-emerald-500" />}
                                {selectedNode.type === 'sale' && <Zap className="w-6 h-6 text-amber-500" />}
                            </div>
                         </div>

                         {/* Properties Table */}
                         <div className="border border-slate-700 rounded-lg overflow-hidden">
                             <table className="w-full text-xs">
                                 <tbody className="divide-y divide-slate-800">
                                     {selectedNode.data && Object.entries(selectedNode.data).map(([key, value]) => {
                                         if (key === 'items' || typeof value === 'object') return null; // Skip complex objects
                                         return (
                                             <tr key={key}>
                                                 <td className="px-3 py-2 bg-slate-900 text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                                 <td className="px-3 py-2 text-slate-300 font-mono text-right">{String(value)}</td>
                                             </tr>
                                         );
                                     })}
                                     {!selectedNode.data && (
                                         <tr><td className="p-3 text-center text-slate-500">No additional metadata</td></tr>
                                     )}
                                 </tbody>
                             </table>
                         </div>

                         {/* Connected Actions */}
                         {selectedNode.type === 'product' && selectedNode.data && (
                             <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-lg">
                                 <div className="text-xs text-emerald-400 mb-2 font-bold uppercase">Stock Status</div>
                                 <div className="text-2xl font-mono text-emerald-300">{selectedNode.data.quantity} <span className="text-sm text-emerald-600">units</span></div>
                                 <div className="w-full bg-slate-800 h-1 mt-2 rounded-full overflow-hidden">
                                     <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (selectedNode.data.quantity / 50) * 100)}%` }}></div>
                                 </div>
                             </div>
                         )}

                         {selectedNode.type === 'sale' && selectedNode.data && (
                             <div>
                                 <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Items in Transaction</h4>
                                 <div className="space-y-1">
                                     {(selectedNode.data.items as any[]).map((item, i) => (
                                         <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-800/50 rounded border border-slate-800">
                                             <span className="text-slate-300">{item.name}</span>
                                             <span className="font-mono text-slate-500">x{item.quantity}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )}
                     </div>
                 ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                         <Target className="w-12 h-12 mb-4" />
                         <p className="text-sm text-center px-4">Select a node in the network graph to inspect details.</p>
                     </div>
                 )}
             </div>
          </div>
       </div>
    </div>
  );
};