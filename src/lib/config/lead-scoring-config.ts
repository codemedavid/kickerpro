/**
 * Lead Scoring Configuration Types and Defaults
 */

export interface ScoringConfig {
  priceShopperThreshold: number; // Score below this = price shopper
  priceShopperMessageLimit: number; // Max messages before considering price shopper
  minEngagementForWarm: number; // Min messages for Warm lead
  minEngagementForHot: number; // Min messages for Hot lead
  strictPriceShopperMode: boolean; // Strict detection of price shoppers
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  priceShopperThreshold: 30,
  priceShopperMessageLimit: 2,
  minEngagementForWarm: 3,
  minEngagementForHot: 5,
  strictPriceShopperMode: false
};

export interface LeadQualificationData {
  hasBudget: boolean;
  hasAuthority: boolean;
  hasNeed: boolean;
  hasTimeline: boolean;
  engagementLevel: 'high' | 'medium' | 'low';
}

export interface LeadScore {
  conversationId: string;
  contactName: string;
  score: number; // 0-100
  quality: 'Hot' | 'Warm' | 'Cold' | 'Unqualified';
  qualificationData: LeadQualificationData;
  signals: string[];
  reasoning: string;
  recommendedAction: string;
}

export interface ConversationMessage {
  from: string; // 'customer' or 'business'
  message: string;
  timestamp?: string;
}

export interface ConversationAnalysis {
  messages: ConversationMessage[];
  messageCount: number;
  businessResponseCount: number;
  customerResponseCount: number;
  conversationLength: number;
}

// Quality tag definitions
export const QUALITY_TAGS = [
  { name: '🔥 Hot Lead', color: '#ef4444', quality: 'Hot' },
  { name: '🟠 Warm Lead', color: '#f97316', quality: 'Warm' },
  { name: '🟡 Cold Lead', color: '#eab308', quality: 'Cold' },
  { name: '⚪ Unqualified', color: '#6b7280', quality: 'Unqualified' },
  { name: '💰 Price Shopper', color: '#8b5cf6', quality: 'PriceShopper' }
] as const;

