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
  sales: SaleRecord[]
): Promise<string> => {
  try {
    const ai = getClient();
    
    // Prepare data summary to reduce token usage while providing context
    const inventorySummary = inventory.map(item => 
      `- ${item.name} (${item.category}): Qty ${item.quantity}, Cost GH₵${item.costPrice}, Sell GH₵${item.salesPrice}`
    ).join('\n');

    const last5Sales = sales.slice(0, 50).map(s => 
      `- Date: ${new Date(s.timestamp).toLocaleDateString()}, Total: GH₵${s.totalAmount.toFixed(2)}, Profit: GH₵${s.totalProfit.toFixed(2)}`
    ).join('\n');

    const prompt = `
      You are an expert business consultant for "Raha Soldi Ent", a Ghanaian general trading company.
      
      Current Inventory Data:
      ${inventorySummary}

      Recent Sales History (Last 50 transactions):
      ${last5Sales}

      Please provide a concise but insightful analysis of the business status. 
      1. Identify low stock items that need immediate restocking (if any).
      2. Suggest which items are likely most profitable based on the margin (Sales Price - Cost Price).
      3. Give general advice on inventory mix or pricing strategy.
      
      Keep the tone professional, encouraging, and actionable. Use the currency GH₵.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed for UI
      }
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Error generating insights:", error);
    return "Error connecting to AI service. Please check your API key and try again.";
  }
};