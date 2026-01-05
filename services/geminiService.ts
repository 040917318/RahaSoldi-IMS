import { GoogleGenAI } from "@google/genai";
import { InventoryItem, SaleRecord } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateBusinessInsights = async (
  inventory: InventoryItem[],
  sales: SaleRecord[],
  startDate?: Date,
  endDate?: Date,
  customQuery?: string
): Promise<string> => {
  try {
    const ai = getClient();

    // Filter sales by date if provided
    let filteredSales = sales;
    if (startDate) {
        // Create start date at 00:00:00
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filteredSales = filteredSales.filter(s => new Date(s.timestamp) >= start);
    }
    if (endDate) {
        // Create end date at 23:59:59
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredSales = filteredSales.filter(s => new Date(s.timestamp) <= end);
    }

    // Summarize Inventory
    // To save context tokens and provide high-level overview
    const inventorySummary = inventory.slice(0, 100).map(item => 
      `- ${item.name} (${item.category}): Qty ${item.quantity}, Cost ${item.costPrice}, Sell ${item.salesPrice}`
    ).join('\n');
    
    const inventoryStats = {
        totalItems: inventory.length,
        totalValue: inventory.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0),
        lowStockCount: inventory.filter(i => i.quantity <= i.lowStockThreshold).length
    };

    // Summarize Sales
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalProfit = filteredSales.reduce((sum, s) => sum + s.totalProfit, 0);
    const salesCount = filteredSales.length;

    // Provide detailed transaction list (limit to recent 50 within the filtered set)
    const recentSalesDetails = filteredSales.slice(0, 50).map(s => 
      `- ${new Date(s.timestamp).toLocaleDateString()}: Items[${s.items.map(i => i.name).join(', ')}], Total ${s.totalAmount.toFixed(2)}`
    ).join('\n');

    const context = `
      Data Context:
      Analysis Period: ${startDate ? startDate.toLocaleDateString() : 'All Time'} to ${endDate ? endDate.toLocaleDateString() : 'Now'}
      
      Sales Performance in Period:
      - Total Revenue: GH₵${totalRevenue.toFixed(2)}
      - Total Profit: GH₵${totalProfit.toFixed(2)}
      - Transaction Count: ${salesCount}

      Inventory Overview (Current Snapshot):
      - Total SKUs: ${inventoryStats.totalItems}
      - Total Valuation: GH₵${inventoryStats.totalValue.toFixed(2)}
      - Items Low on Stock: ${inventoryStats.lowStockCount}
    `;

    let prompt = `
      You are an expert business consultant for "Raha Soldi Ent", a Ghanaian general trading company.
      
      ${context}

      Current Inventory Details (Sample):
      ${inventorySummary}

      Transactions in Selected Period (Sample up to 50):
      ${recentSalesDetails}
    `;

    if (customQuery && customQuery.trim() !== "") {
        prompt += `
        
        USER QUESTION: "${customQuery}"
        
        Please answer the user's question specifically based on the provided data context. 
        If the data is insufficient to answer the question fully, explain why and provide the best possible related insights.
        Focus on the data from the specified period.
        `;
    } else {
        prompt += `
        
        Please provide a concise but insightful analysis of the business status for this period. 
        
        1. **Sales & Profitability:** Analyze performance trends. Are margins healthy?
        2. **Inventory Health:** Identify low stock items and suggest restocking priorities.
        3. **Top Performers:** Which items are driving revenue?
        4. **Recommendations:** Give actionable advice on pricing, bundling, or stock mix.
        
        Keep the tone professional, encouraging, and actionable. Use the currency GH₵. Format the response with Markdown for readability (bolding, lists).
        `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Error generating insights:", error);
    return "Error connecting to AI service. Please check your API key and try again.";
  }
};