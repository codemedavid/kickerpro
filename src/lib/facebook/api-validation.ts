/**
 * FIX #9: Facebook API Response Validation
 * Ensures we handle API schema changes gracefully
 */

import { z, ZodError } from 'zod';

// ============================================================================
// FACEBOOK API SCHEMAS
// ============================================================================

/**
 * Participant schema with strict validation
 */
export const ParticipantSchema = z.object({
  id: z.string().min(1, 'Participant ID cannot be empty'),
  name: z.string().optional(),
  email: z.string().optional()
});

/**
 * Message schema
 */
export const MessageSchema = z.object({
  id: z.string().optional(),
  message: z.string().optional(),
  created_time: z.string(), // ISO timestamp
  from: z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().optional()
  }).optional()
});

/**
 * Conversation schema from Facebook API
 */
export const ConversationSchema = z.object({
  id: z.string(),
  updated_time: z.string(), // ISO timestamp
  participants: z.object({
    data: z.array(ParticipantSchema)
  }).optional(),
  messages: z.object({
    data: z.array(MessageSchema)
  }).optional()
});

/**
 * Facebook API response schema
 */
export const FacebookConversationsResponseSchema = z.object({
  data: z.array(ConversationSchema),
  paging: z.object({
    cursors: z.object({
      before: z.string().optional(),
      after: z.string().optional()
    }).optional(),
    next: z.string().optional(),
    previous: z.string().optional()
  }).optional(),
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional()
  }).optional()
});

/**
 * Facebook error response
 */
export const FacebookErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional()
  })
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type Participant = z.infer<typeof ParticipantSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type FacebookConversationsResponse = z.infer<typeof FacebookConversationsResponseSchema>;
export type FacebookError = z.infer<typeof FacebookErrorSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate participant data
 */
export function validateParticipant(data: unknown): Participant | null {
  try {
    return ParticipantSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      console.warn('[API Validation] Invalid participant:', {
        data,
        errors: error.issues
      });
    }
    return null;
  }
}

/**
 * Validate message data
 */
export function validateMessage(data: unknown): Message | null {
  try {
    return MessageSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      console.warn('[API Validation] Invalid message:', {
        data,
        errors: error.issues
      });
    }
    return null;
  }
}

/**
 * Validate conversation data
 */
export function validateConversation(data: unknown): Conversation | null {
  try {
    return ConversationSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      console.warn('[API Validation] Invalid conversation:', {
        data,
        errors: error.issues
      });
    }
    return null;
  }
}

/**
 * Validate and parse Facebook API response
 */
export function validateFacebookResponse(
  data: unknown
): { success: true; data: FacebookConversationsResponse } | { success: false; error: string } {
  try {
    const validated = FacebookConversationsResponseSchema.parse(data);
    
    // Check if response contains an error
    if (validated.error) {
      return {
        success: false,
        error: `Facebook API Error (${validated.error.code}): ${validated.error.message}`
      };
    }
    
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('[API Validation] Response validation failed:', {
        errors: error.issues,
        data
      });
      
      return {
        success: false,
        error: `Invalid Facebook API response structure: ${error.issues.map(e => e.message).join(', ')}`
      };
    }
    
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
}

/**
 * Safe participant extraction with validation
 * FIX #7: Validate all participant data before processing
 */
export function extractValidParticipants(
  conversation: unknown,
  pageId: string
): Participant[] {
  try {
    const conv = ConversationSchema.parse(conversation);
    const participants = conv.participants?.data || [];
    
    return participants
      .map(p => validateParticipant(p))
      .filter((p): p is Participant => {
        if (!p) return false;
        if (p.id === pageId) return false; // Skip page itself
        return true;
      });
  } catch {
    console.warn('[API Validation] Could not extract participants from conversation');
    return [];
  }
}

/**
 * Safe message extraction with validation
 * FIX #8: Process ALL valid messages, not just 25
 */
export function extractValidMessages(
  conversation: unknown,
  limit?: number
): Message[] {
  try {
    const conv = ConversationSchema.parse(conversation);
    const messages = conv.messages?.data || [];
    
    const validMessages = messages
      .map(m => validateMessage(m))
      .filter((m): m is Message => m !== null);
    
    // Apply limit if specified
    return limit ? validMessages.slice(0, limit) : validMessages;
  } catch {
    console.warn('[API Validation] Could not extract messages from conversation');
    return [];
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Check if error is a Facebook API error
 */
export function isFacebookError(error: unknown): error is FacebookError {
  try {
    FacebookErrorSchema.parse(error);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user-friendly error message from Facebook error
 */
export function getFacebookErrorMessage(error: unknown): string {
  if (!isFacebookError(error)) {
    return 'Unknown error occurred';
  }
  
  const code = error.error.code;
  const message = error.error.message;
  
  // Map common error codes to user-friendly messages
  const errorMessages: Record<number, string> = {
    4: 'Facebook API rate limit reached. Please try again in a few minutes.',
    17: 'Too many requests. Please wait before trying again.',
    190: 'Facebook authentication expired. Please reconnect your account.',
    200: 'Insufficient permissions. Please reconnect with required permissions.',
    368: 'Temporarily blocked by Facebook. Please try again later.',
    613: 'API rate limit exceeded. Please try again later.'
  };
  
  return errorMessages[code] || message || 'Facebook API error';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!isFacebookError(error)) {
    return true; // Unknown errors should be retried
  }
  
  const code = error.error.code;
  
  // Rate limit errors are retryable
  if (code === 4 || code === 17 || code === 613) {
    return true;
  }
  
  // Temporary errors are retryable
  if (code === 1 || code === 2) {
    return true;
  }
  
  // Permission and auth errors are NOT retryable
  if (code === 190 || code === 200) {
    return false;
  }
  
  return false;
}

// ============================================================================
// VALIDATION STATISTICS
// ============================================================================

/**
 * Track validation statistics for monitoring
 */
export class ValidationStats {
  private stats = {
    totalConversations: 0,
    validConversations: 0,
    invalidConversations: 0,
    totalParticipants: 0,
    validParticipants: 0,
    invalidParticipants: 0,
    totalMessages: 0,
    validMessages: 0,
    invalidMessages: 0
  };

  recordConversation(isValid: boolean) {
    this.stats.totalConversations++;
    if (isValid) {
      this.stats.validConversations++;
    } else {
      this.stats.invalidConversations++;
    }
  }

  recordParticipant(isValid: boolean) {
    this.stats.totalParticipants++;
    if (isValid) {
      this.stats.validParticipants++;
    } else {
      this.stats.invalidParticipants++;
    }
  }

  recordMessage(isValid: boolean) {
    this.stats.totalMessages++;
    if (isValid) {
      this.stats.validMessages++;
    } else {
      this.stats.invalidMessages++;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  getInvalidRate() {
    return {
      conversations: this.stats.totalConversations > 0 
        ? (this.stats.invalidConversations / this.stats.totalConversations * 100).toFixed(2) + '%'
        : '0%',
      participants: this.stats.totalParticipants > 0
        ? (this.stats.invalidParticipants / this.stats.totalParticipants * 100).toFixed(2) + '%'
        : '0%',
      messages: this.stats.totalMessages > 0
        ? (this.stats.invalidMessages / this.stats.totalMessages * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  reset() {
    Object.keys(this.stats).forEach(key => {
      this.stats[key as keyof typeof this.stats] = 0;
    });
  }
}

