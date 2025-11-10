'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QuotaStatus {
  available_keys: number;
  total_keys: number;
  all_exhausted: boolean;
  estimated_reset_hours: number;
  last_error?: string;
}

export function GeminiQuotaIndicator() {
  const { data: quota, isLoading } = useQuery<QuotaStatus>({
    queryKey: ['gemini-quota-status'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/quota-status');
      if (!response.ok) throw new Error('Failed to fetch quota status');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 1
  });

  if (isLoading || !quota) {
    return null;
  }

  const getStatusColor = (): 'destructive' | 'outline' | 'default' => {
    if (quota.all_exhausted) return 'destructive';
    if (quota.available_keys < 3) return 'outline';
    return 'default';
  };

  const getStatusIcon = () => {
    if (quota.all_exhausted) return <AlertCircle className="w-4 h-4" />;
    if (quota.available_keys < 3) return <Clock className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (quota.all_exhausted) {
      return `API Quota Exhausted (${quota.available_keys}/${quota.total_keys} keys)`;
    }
    if (quota.available_keys < 3) {
      return `Low API Quota (${quota.available_keys}/${quota.total_keys} keys)`;
    }
    return `API Ready (${quota.available_keys}/${quota.total_keys} keys)`;
  };

  const getTooltipContent = () => {
    if (quota.all_exhausted) {
      return `All ${quota.total_keys} Gemini API keys have hit their daily quota. Using test mode (keyword matching) for sorting. Quota resets in approximately ${quota.estimated_reset_hours} hours.`;
    }
    if (quota.available_keys < 3) {
      return `${quota.total_keys - quota.available_keys} of ${quota.total_keys} API keys are rate-limited. Still using AI analysis with remaining keys.`;
    }
    return `All ${quota.total_keys} Gemini API keys are available. Using full AI analysis for pipeline sorting.`;
  };

  const getAnalysisMode = () => {
    if (quota.all_exhausted) {
      return (
        <div className="text-xs text-muted-foreground mt-1">
          Mode: 🧪 Test Mode (Keyword Matching)
        </div>
      );
    }
    return (
      <div className="text-xs text-muted-foreground mt-1">
        Mode: ✨ AI Analysis
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="w-fit cursor-help">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${quota.all_exhausted ? 'text-red-500' : quota.available_keys < 3 ? 'text-yellow-500' : 'text-green-500'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor()} className="flex items-center gap-1">
                      {getStatusIcon()}
                      <span className="text-xs">{getStatusText()}</span>
                    </Badge>
                  </div>
                  {getAnalysisMode()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{getTooltipContent()}</p>
          {quota.all_exhausted && (
            <p className="mt-2 text-xs">
              Tip: Test mode provides 70-80% accuracy using keyword matching. 
              Full AI mode (85-95% accuracy) will return when quota resets.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function GeminiQuotaIndicatorCompact() {
  const { data: quota, isLoading } = useQuery<QuotaStatus>({
    queryKey: ['gemini-quota-status'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/quota-status');
      if (!response.ok) throw new Error('Failed to fetch quota status');
      return response.json();
    },
    refetchInterval: 60000,
    retry: 1
  });

  if (isLoading || !quota) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={quota.all_exhausted ? 'destructive' : quota.available_keys < 3 ? 'outline' : 'default'}
            className="cursor-help flex items-center gap-1"
          >
            <Zap className={`w-3 h-3 ${quota.all_exhausted ? 'text-red-500' : quota.available_keys < 3 ? 'text-yellow-500' : 'text-green-500'}`} />
            <span>{quota.available_keys}/{quota.total_keys}</span>
            {quota.all_exhausted && <span className="text-xs">🧪 Test Mode</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {quota.all_exhausted 
              ? `API quota exhausted. Using test mode. Resets in ~${quota.estimated_reset_hours}h.`
              : `${quota.available_keys} of ${quota.total_keys} API keys available for AI analysis.`
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

