
import { GoogleGenAI, Type } from "@google/genai";
import type { InventoryItem, AIActionResponse } from "../types";
import { MASTER_INVENTORY_LIST } from "../lib/knowledgeBase";


const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set. Please set it to use AI features.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const aiActionsSchema = {
  type: Type.OBJECT,
  properties: {
    reasoning: {
      type: Type.STRING,
      description: "A brief, professional analysis of the inventory levels and the justification for the suggested action (either a purchase order or a promotion).",
    },
    purchaseOrderItems: {
      type: Type.ARRAY,
      description: "A list of items to be ordered. Only include for understocking scenarios. Should be empty if a promotion is suggested.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
          unit: { type: Type.STRING }
        },
        required: ["id", "name", "quantity", "unit"],
      },
    },
    promotionCampaign: {
        type: Type.OBJECT,
        description: "Details for a promotional campaign to address overstocked items. Should only be included for overstocking scenarios.",
        properties: {
            reasoning: {
                type: Type.STRING,
                description: "A specific reasoning for the promotion, highlighting spoilage risk and financial impact."
            },
            financialImpact: {
                type: Type.NUMBER,
                description: "The estimated financial impact in HKD."
            },
            recommendedPromotion: {
                type: Type.STRING,
                description: "A specific, actionable promotion recommendation."
            },
            productName: {
                type: Type.STRING,
                description: "The name of the specific product being promoted (e.g., 'Large Fries', 'Crispy Chicken Thighs'). This will be displayed in the text block."
            },
            promotionName: {
                type: Type.STRING,
                description: "The catchy name of the promotion (e.g., 'Buy 1 Get 1 Free', 'Special Deal'). This will be displayed in the text block."
            },
            imagePrompt: {
                type: Type.STRING,
                description: "A detailed, descriptive English prompt for an image generation model to create a marketing visual. It must NOT contain text. If the promotion is 'Buy 1 Get 1 Free', it must describe two products. Otherwise, it must describe one. This is a mandatory, non-empty field."
            }
        },
        required: ["reasoning", "financialImpact", "recommendedPromotion", "productName", "promotionName", "imagePrompt"]
    }
  },
  required: ["reasoning"],
};

export const analyzeImageForInventory = async (
    shelfImage: string,
    referenceImages: Record<string, {name: string, data: string}>
): Promise<InventoryItem[]> => {
  const model = "gemini-2.5-flash";

  const shelfImagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: shelfImage,
    },
  };

  const referenceImageParts = Object.values(referenceImages).map(ref => ({
      inlineData: {
          mimeType: "image/jpeg",
          data: ref.data
      }
  }));

  const referenceItemsPrompt = Object.entries(referenceImages).map(([id, ref], index) => 
    `- Image ${index + 2} is a reference for item ID '${id}' (Name: ${ref.name}).`
  ).join('\n');

  const textPart = {
    text: `
You are an advanced inventory counting system. Your task is to perform one-shot visual analysis.

You have been provided with multiple images:
- The first image is the main inventory shelf to be analyzed.
- The subsequent images are reference images for specific items.

**Reference Key:**
${referenceItemsPrompt}

**Instructions:**
1.  Carefully examine the first image (the inventory shelf).
2.  For each reference image provided, locate and count all matching items on the inventory shelf.
3.  Return your findings as a JSON object that adheres to the provided schema.
4.  The JSON should contain a list of all items specified in the reference key.
5.  If an item from the reference key is not visible on the shelf, its quantity must be 0.
6.  Ensure your response is ONLY the JSON object, with no extra text, comments, or markdown formatting.`,
  };

  const inventorySchema = {
    type: Type.OBJECT,
    properties: {
        inventory: {
            type: Type.ARRAY,
            description: "A list of all identified inventory items based on the reference images.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "The unique ID of the item (e.g., 'straws'), matching the reference key."},
                    name: { type: Type.STRING, description: "The name of the item."},
                    quantity: { type: Type.INTEGER, description: "The counted quantity of the item. Use 0 if not found."},
                    unit: { type: Type.STRING, description: "The unit of the item (e.g., 'packs')."}
                },
                required: ["id", "name", "quantity", "unit"],
            }
        }
    },
    required: ["inventory"]
  };
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [textPart, shelfImagePart, ...referenceImageParts] },
      config: {
        responseMimeType: "application/json",
        responseSchema: inventorySchema,
      },
    });

    const jsonText = response.text.trim();
    const result: { inventory: (Omit<InventoryItem, 'quantity'> & { quantity: number | string})[] } = JSON.parse(jsonText);
    
    if (!result || !Array.isArray(result.inventory)) {
        throw new Error("AI response did not contain a valid inventory list.");
    }
    
    // Create a map of valid item IDs to ensure we only return items from our master list
    const validIds = new Set(MASTER_INVENTORY_LIST.map(item => item.id));

    return result.inventory
      .filter(item => validIds.has(item.id)) // Filter out any unexpected items
      .map(item => ({
        ...item,
        quantity: typeof item.quantity === 'string' ? parseInt(item.quantity, 10) || 0 : item.quantity,
    }));

  } catch (error: any) {
    console.error("Error calling Gemini Vision API:", error);
    const errorMessage = error.toString();
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("API rate limit exceeded. Please wait a moment and try again.");
    }
    throw new Error("Failed to analyze inventory image with AI. Check console for details.");
  }
};

export const suggestActionForInventory = async (
  currentInventory: InventoryItem[]
): Promise<AIActionResponse> => {
  const model = "gemini-2.5-flash";

  const prompt = `
You are an AI inventory manager for a McDonald's franchise. Your task is to analyze the current inventory and suggest the best course of action.

**Context:**
- Your goal is to maintain a target inventory level for all items, which represents a safe 3-day supply.
- An inventory check was just performed via camera analysis.
- Overstocking leads to spoilage and financial loss.

**Current Inventory State:**
${JSON.stringify(currentInventory, null, 2)}

**Target Inventory Levels (3-Day Supply):**
- Ketchup: 2 packs
- 'Thai & Hot Spicy Sauce': 4 packs
- Straws: 5 packs

**Instructions:**
1.  **Analyze Inventory:** For each item, compare its current quantity to its 'Target Inventory Level'.
2.  **Check for Overstocking (Priority 1):**
    - First, determine if any item is overstocked. An item is considered overstocked if it has 2 or more units than its target inventory level. For example: Ketchup is overstocked at 4 packs (target is 2), 'Thai & Hot Spicy Sauce' is overstocked at 6 packs (target is 4), and Straws are overstocked at 7 packs (target is 5).
    - If one or more items are overstocked, you MUST take the following steps:
        - Identify the single *most* overstocked item. This is the item with the highest ratio of (current quantity / target quantity).
        - Your response MUST be a promotion campaign. The \`purchaseOrderItems\` field must be empty or not present.
        - The main \`reasoning\` field should explain the overstock situation.
        - The \`promotionCampaign\` object must be fully populated:
            - \`reasoning\`: State the spoilage risk and the potential financial impact of ~480 HKD.
            - \`recommendedPromotion\`: Suggest a promotion based on the most overstocked item:
                - If Ketchup: "Recommend selling Fries (L) with a 'Buy 1 Get 1 Free' promotion."
                - If 'Thai & Hot Spicy Sauce': "Recommend selling Crispy Chicken Thighs with a 'Buy 1 Get 1 Free' promotion."
                - If Straws: "Recommend selling Drinks like Coca-Cola with a 'Buy 1 Get 1 Free' promotion."
            - \`productName\`: The name of the product from the promotion (e.g., "Fries (L)", "Crispy Chicken Thighs").
            - \`promotionName\`: The name of the deal itself (e.g., "Buy 1 Get 1 Free").
            - \`imagePrompt\`: **This is a CRITICAL and MANDATORY field. You absolutely MUST generate a detailed prompt for a hero image.** The prompt must be in English and describe an appetizing promotional photo for the recommended item. **DO NOT INCLUDE ANY TEXT IN THE PROMPT, as text will be displayed separately.**
              - **Crucially, if the \`recommendedPromotion\` is 'Buy 1 Get 1 Free', your prompt MUST describe TWO of the product to accurately reflect the offer.** For example, for Fries (L), a good prompt would be: 'A vibrant, eye-catching promotional photo of two cartons of large, golden french fries from McDonald's side-by-side. Show steam rising from the crispy fries in their iconic red cartons. Clean, appealing background.'
              - **If it is NOT a 'Buy 1 Get 1 Free' promotion, describe a single, beautiful hero shot of the product.**
              - This field CANNOT be empty under any circumstances when a promotion is suggested.
3.  **Check for Understocking (Priority 2):**
    - **Only if no items are overstocked**, check for understocking. An item is understocked if its stock is less than its target.
    - If understocking is found, you must generate a purchase order. The \`promotionCampaign\` field must be empty or not present.
    - Calculate the \`quantity\` to order for each understocked item to reach its target level (\`Target - Current\`).
    - The \`purchaseOrderItems\` list should only contain items that need restocking (order quantity > 0).
    - Provide a concise \`reasoning\` for the purchase order.
4.  **Optimal Stock (Priority 3):** If stock is neither overstocked nor understocked, state that inventory is optimal in the 'reasoning' and return empty/null for 'purchaseOrderItems' and 'promotionCampaign'.
5.  **Response Format:** Generate a response in JSON format according to the provided schema.
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: aiActionsSchema,
      },
    });

    const jsonText = response.text.trim();
    const result: AIActionResponse = JSON.parse(jsonText);

    if(result.purchaseOrderItems){
        result.purchaseOrderItems = result.purchaseOrderItems.filter(item => item.quantity > 0);
    }

    if (result.promotionCampaign && (!result.promotionCampaign.productName || !result.promotionCampaign.promotionName)) {
        console.warn("AI response for promotion was missing product or promotion name.");
        // We could attempt to parse it from `recommendedPromotion` here as a fallback if needed
    }


    return result;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    const errorMessage = error.toString();
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("API rate limit exceeded. Please wait a moment and try again.");
    }
    throw new Error("Failed to communicate with the AI service. Check console for details.");
  }
};

const addItemsIntentSchema = {
    type: Type.OBJECT,
    properties: {
        addItems: { 
            type: Type.BOOLEAN,
            description: "Set to true if the user wants to add items to the purchase order, false otherwise."
        }
    },
    required: ["addItems"]
};

export const shouldAddStandardItems = async (prompt: string): Promise<boolean> => {
    const model = "gemini-2.5-flash";
    
    const systemPrompt = `You are an AI that determines user intent from a brief command. The user is managing a restaurant's purchase order. Your task is to analyze the user's request and decide if they want to add a standard list of new items to their order. Requests that mean YES (should return true): "add the standard items", "add new items", "stock up on the usuals", "add beef, chicken, and fries", "we need more inventory", "prompt". Requests that mean NO (should return false): "remove the straws", "this looks good", "who is the supplier?", "change ketchup quantity to 10". You must respond with ONLY a single JSON object in the format: {"addItems": boolean}.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: `${systemPrompt}\n\nUser Request: "${prompt}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: addItemsIntentSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const result: { addItems: boolean } = JSON.parse(jsonText);
        
        return result.addItems;

    } catch (error: any) {
        console.error("Error calling Gemini API for intent detection:", error);
        const errorMessage = error.toString();
        if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error("Failed to understand the command. Please try rephrasing.");
    }
};

export const generatePromotionImage = async (prompt: string): Promise<string> => {
    if (!prompt || !prompt.trim()) {
        console.error("Image generation prompt is empty. Aborting API call.");
        throw new Error("Cannot generate image: The AI model failed to provide a visual description.");
    }
    
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0]?.image?.imageBytes) {
            return response.generatedImages[0].image.imageBytes;
        } else {
            throw new Error("AI did not return a valid image.");
        }
    } catch (error: any) {
        console.error("Error calling Imagen API:", error);
        const errorMessage = error.toString();
        if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("API rate limit exceeded for image generation. Please wait a moment and try again.");
        }
        throw new Error("Failed to generate promotional image.");
    }
};
