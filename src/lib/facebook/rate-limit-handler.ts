/**
 * Facebook API Rate Limit Handler
 * Handles rate limiting and retry logic for Facebook Graph API
 */

interface FacebookAPIError {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: FacebookAPIError): boolean {
  const code = error.error?.code;
  const subcode = error.error?.error_subcode;
  
  // Facebook rate limit error codes
  // 4 = Application request limit reached
  // 17 = User request limit reached
  // 613 = Calls to this API have exceeded the rate limit
  return code === 4 || code === 17 || code === 613 || subcode === 2446079;
}

/**
 * Check if error is a temporary error that should be retried
 */
export function isTemporaryError(error: FacebookAPIError): boolean {
  const code = error.error?.code;
  
  // Temporary errors that should be retried
  // 1 = Unknown error (might be temporary)
  // 2 = Temporary service issue
  return code === 1 || code === 2;
}

/**
 * Get retry delay from response headers or calculate exponential backoff
 */
export function getRetryDelay(
  response: Response,
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 32000
): number {
  // Check for Retry-After header
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const delay = parseInt(retryAfter, 10) * 1000;
    if (!isNaN(delay)) {
      return Math.min(delay, maxDelay);
    }
  }
  
  // Exponential backoff: baseDelay * 2^attempt
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry and rate limit handling
 */
export async function fetchWithRetry(
  url: string,
  options: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 32000,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Get error details
      const errorData = await response.json() as FacebookAPIError;

      // Check if it's a rate limit error
      if (isRateLimitError(errorData)) {
        if (attempt < maxRetries) {
          const delay = getRetryDelay(response, attempt, baseDelay, maxDelay);
          console.warn(
            `[Facebook API] Rate limit reached. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await sleep(delay);
          continue;
        } else {
          throw new Error(
            `Rate limit exceeded. Please try again later. (${errorData.error?.message || 'Unknown error'})`
          );
        }
      }

      // Check if it's a temporary error
      if (isTemporaryError(errorData)) {
        if (attempt < maxRetries) {
          const delay = getRetryDelay(response, attempt, baseDelay, maxDelay);
          console.warn(
            `[Facebook API] Temporary error. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await sleep(delay);
          continue;
        }
      }

      // Not a retryable error - throw immediately
      throw new Error(
        errorData.error?.message || 'Facebook API request failed'
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Network errors - retry
      if (attempt < maxRetries) {
        const delay = getRetryDelay(new Response(), attempt, baseDelay, maxDelay);
        console.warn(
          `[Facebook API] Network error. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Parse Facebook error message for user-friendly display
 */
export function getUserFriendlyErrorMessage(error: FacebookAPIError): string {
  const code = error.error?.code;
  const message = error.error?.message;

  switch (code) {
    case 4:
    case 17:
    case 613:
      return 'Facebook API rate limit reached. Please try again in a few minutes.';
    
    case 190:
      return 'Your Facebook token has expired. Please reconnect your Facebook account.';
    
    case 100:
      return 'Invalid Facebook request. Please try again or contact support.';
    
    case 200:
      return 'Insufficient permissions. Please reconnect your Facebook account with the required permissions.';
    
    case 368:
      return 'You have been temporarily blocked from accessing this Facebook feature. Please try again later.';
    
    default:
      return message || 'An error occurred while communicating with Facebook. Please try again.';
  }
}

