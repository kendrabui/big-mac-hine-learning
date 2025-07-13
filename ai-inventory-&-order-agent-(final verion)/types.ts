
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface PurchaseOrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface PromotionCampaign {
    reasoning: string;
    financialImpact: number;
    recommendedPromotion: string;
    productName: string;
    promotionName: string;
    imagePrompt: string;
}

export interface AIActionResponse {
    reasoning: string;
    purchaseOrderItems?: PurchaseOrderItem[];
    promotionCampaign?: PromotionCampaign;
}

export type AppStatus = 'idle' | 'loading' | 'generated' | 'approved' | 'rejected' | 'error' | 'promotionSuggested' | 'promotionApproved' | 'promotionRejected';

export interface CameraFeedHandles {
  captureFrame: () => string | null;
}