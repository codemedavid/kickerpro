// Facebook Batch API for parallel requests
// https://developers.facebook.com/docs/graph-api/making-multiple-requests

export interface BatchRequest {
  method: 'GET' | 'POST' | 'DELETE';
  relative_url: string;
  body?: string;
  name?: string;
  omit_response_on_success?: boolean;
}

export interface BatchResponse {
  code: number;
  headers: Array<{ name: string; value: string }>;
  body: string;
}

/**
 * Execute multiple Facebook API requests in a single batch
 * @param accessToken - Page or user access token
 * @param requests - Array of batch requests (max 50)
 * @returns Array of responses in the same order as requests
 */
export async function executeBatchRequest(
  accessToken: string,
  requests: BatchRequest[]
): Promise<BatchResponse[]> {
  if (requests.length === 0) {
    return [];
  }

  if (requests.length > 50) {
    throw new Error('Facebook Batch API supports max 50 requests per batch');
  }

  const url = 'https://graph.facebook.com/v18.0/';
  const formData = new URLSearchParams();
  formData.append('access_token', accessToken);
  formData.append('batch', JSON.stringify(requests));

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Batch API error: ${error.error?.message || 'Unknown error'}`);
  }

  const results: BatchResponse[] = await response.json();
  return results;
}

/**
 * Fetch conversations from multiple pages in parallel using Batch API
 */
export async function batchFetchConversations(
  pages: Array<{ facebookPageId: string; accessToken: string; lastSyncTime?: string }>,
  limit: number = 100
): Promise<Map<string, Array<Record<string, unknown>>>> {
  const conversationsByPage = new Map<string, Array<Record<string, unknown>>>();

  // Split into batches of 50 (Facebook limit)
  const batches: typeof pages[] = [];
  for (let i = 0; i < pages.length; i += 50) {
    batches.push(pages.slice(i, i + 50));
  }

  for (const batch of batches) {
    if (batch.length === 0) continue;

    // Use first page's token for batch request (all pages must be accessible with same token)
    const accessToken = batch[0].accessToken;

    // Create batch requests
    const requests: BatchRequest[] = batch.map((page) => {
      const sinceParam = page.lastSyncTime
        ? `&since=${Math.floor(new Date(page.lastSyncTime).getTime() / 1000)}`
        : '';

      return {
        method: 'GET',
        relative_url: `${page.facebookPageId}/conversations?fields=participants,updated_time,messages{message,created_time,from}&limit=${limit}${sinceParam}`,
        name: page.facebookPageId,
      };
    });

    try {
      const responses = await executeBatchRequest(accessToken, requests);

      // Parse responses
      responses.forEach((response, index) => {
        const pageId = batch[index].facebookPageId;

        if (response.code === 200) {
          try {
            const data = JSON.parse(response.body);
            conversationsByPage.set(pageId, data.data || []);
          } catch (error) {
            console.error(`[Batch API] Error parsing response for ${pageId}:`, error);
            conversationsByPage.set(pageId, []);
          }
        } else {
          console.error(`[Batch API] Error for ${pageId}: ${response.code}`);
          conversationsByPage.set(pageId, []);
        }
      });
    } catch (error) {
      console.error('[Batch API] Batch request failed:', error);
      // Set empty arrays for failed batch
      batch.forEach((page) => {
        conversationsByPage.set(page.facebookPageId, []);
      });
    }
  }

  return conversationsByPage;
}

/**
 * Fetch user info for multiple PSIDs in parallel
 */
export async function batchFetchUserInfo(
  psids: string[],
  accessToken: string
): Promise<Map<string, { name: string; profile_pic?: string }>> {
  const userInfo = new Map<string, { name: string; profile_pic?: string }>();

  if (psids.length === 0) return userInfo;

  // Split into batches of 50
  const batches: string[][] = [];
  for (let i = 0; i < psids.length; i += 50) {
    batches.push(psids.slice(i, i + 50));
  }

  for (const batch of batches) {
    const requests: BatchRequest[] = batch.map((psid) => ({
      method: 'GET',
      relative_url: `${psid}?fields=name,profile_pic`,
      name: psid,
    }));

    try {
      const responses = await executeBatchRequest(accessToken, requests);

      responses.forEach((response, index) => {
        const psid = batch[index];

        if (response.code === 200) {
          try {
            const data = JSON.parse(response.body);
            userInfo.set(psid, {
              name: data.name || 'Facebook User',
              profile_pic: data.profile_pic,
            });
          } catch (error) {
            console.error(`[Batch API] Error parsing user info for ${psid}:`, error);
          }
        }
      });
    } catch (error) {
      console.error('[Batch API] Batch user info request failed:', error);
    }
  }

  return userInfo;
}

