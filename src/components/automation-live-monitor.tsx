'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, Zap, CheckCircle, XCircle, Loader2, Play, Pause, AlertCircle } from 'lucide-react';

interface ContactState {
  id: string;
  sender_id: string;
  sender_name: string;
  current_stage: string;
  next_send_at: string | null;
  minutes_until_send: number | null;
  status_message: string | null;
  error_message: string | null;
  follow_up_count: number;
  max_follow_ups: number;
  seconds_in_stage: number;
  generated_message: string | null;
  generation_time_ms: number | null;
}

interface StageSummary {
  stage: string;
  count: number;
  avg_time_in_stage: number;
}

interface MonitorData {
  type: string;
  contacts?: ContactState[];
  stageSummary?: StageSummary[];
  stats?: {
    total: number;
    byStage: Record<string, number>;
  };
}

interface AutomationLiveMonitorProps {
  ruleId: string;
  ruleName: string;
  onClose: () => void;
}

const STAGE_CONFIG: Record<string, { label: string; icon: any; color: string; description: string }> = {
  queued: {
    label: 'Queued',
    icon: Clock,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    description: 'Waiting in queue'
  },
  checking: {
    label: 'Checking',
    icon: Loader2,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    description: 'Verifying eligibility'
  },
  eligible: {
    label: 'Eligible',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-700 border-green-300',
    description: 'Eligible, waiting for time window'
  },
  generating: {
    label: 'Generating',
    icon: Zap,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    description: 'AI generating message'
  },
  ready_to_send: {
    label: 'Ready',
    icon: Play,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    description: 'Message ready to send'
  },
  sending: {
    label: 'Sending',
    icon: Loader2,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300 animate-pulse',
    description: 'Sending to Facebook'
  },
  sent: {
    label: 'Sent',
    icon: CheckCircle,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    description: 'Successfully sent'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'bg-red-100 text-red-700 border-red-300',
    description: 'Failed to send'
  },
  skipped: {
    label: 'Skipped',
    icon: Pause,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    description: 'Skipped (limits/hours)'
  }
};

export function AutomationLiveMonitor({ ruleId, ruleName, onClose }: AutomationLiveMonitorProps) {
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource(`/api/ai-automations/${ruleId}/monitor`);

        eventSource.onopen = () => {
          console.log('[Monitor] Connected');
          setIsConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.error) {
              setError(data.error);
              return;
            }

            if (data.type === 'complete') {
              console.log('[Monitor] Stream complete');
              return;
            }

            setMonitorData(data);
          } catch (err) {
            console.error('[Monitor] Error parsing message:', err);
          }
        };

        eventSource.onerror = () => {
          console.error('[Monitor] Connection error');
          setIsConnected(false);
          eventSource?.close();
        };

      } catch (err) {
        console.error('[Monitor] Error connecting:', err);
        setError('Failed to connect to monitoring stream');
      }
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, [ruleId]);

  const getStageIcon = (stage: string) => {
    const Icon = STAGE_CONFIG[stage]?.icon || AlertCircle;
    return Icon;
  };

  const getStageConfig = (stage: string) => {
    return STAGE_CONFIG[stage] || {
      label: stage,
      icon: AlertCircle,
      color: 'bg-gray-100 text-gray-700',
      description: 'Unknown stage'
    };
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Live Monitor: {ruleName}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time automation progress tracking
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isConnected ? 'Live' : 'Disconnected'}
              </Badge>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 font-medium">Error: {error}</p>
            </div>
          )}

          {/* Stage Summary Cards */}
          {monitorData?.stageSummary && monitorData.stageSummary.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">📊 Stage Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {monitorData.stageSummary.map((stage) => {
                  const config = getStageConfig(stage.stage);
                  const Icon = config.icon;
                  return (
                    <Card key={stage.stage} className={`border-2 ${config.color}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{config.label}</span>
                        </div>
                        <div className="text-2xl font-bold">{stage.count}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Avg: {formatTime(stage.avg_time_in_stage)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Contacts List */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Active Contacts ({monitorData?.contacts?.length || 0})
            </h3>

            {!monitorData?.contacts || monitorData.contacts.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="p-8 text-center">
                  <Pause className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-muted-foreground">
                    No active contacts being processed right now
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Contacts will appear here when automation runs
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {monitorData.contacts.map((contact) => {
                  const config = getStageConfig(contact.current_stage);
                  const Icon = config.icon;
                  
                  return (
                    <Card key={contact.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium truncate">{contact.sender_name}</h4>
                              <Badge className={`${config.color} border text-xs`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-2">
                              {config.description}
                            </p>

                            {contact.status_message && (
                              <p className="text-sm text-muted-foreground">
                                {contact.status_message}
                              </p>
                            )}

                            {contact.error_message && (
                              <p className="text-sm text-red-600 mt-1">
                                ❌ {contact.error_message}
                              </p>
                            )}

                            {contact.generated_message && (
                              <div className="mt-2 p-2 bg-purple-50 rounded text-sm">
                                <p className="font-medium text-purple-700 mb-1">Generated Message:</p>
                                <p className="text-gray-700 line-clamp-2">{contact.generated_message}</p>
                              </div>
                            )}
                          </div>

                          <div className="text-right space-y-1">
                            <div className="text-sm text-muted-foreground">
                              In stage: {formatTime(contact.seconds_in_stage)}
                            </div>
                            
                            {contact.minutes_until_send !== null && contact.minutes_until_send > 0 && (
                              <div className="text-sm font-medium text-blue-600">
                                📅 Sends in: {contact.minutes_until_send}m
                              </div>
                            )}

                            {contact.generation_time_ms && (
                              <div className="text-xs text-muted-foreground">
                                ⚡ Generated in {contact.generation_time_ms}ms
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                              Follow-up: {contact.follow_up_count}/{contact.max_follow_ups}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats Footer */}
          {monitorData?.stats && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Total Active: <span className="font-medium text-foreground">{monitorData.stats.total}</span>
                </span>
                <span className="text-muted-foreground">
                  Updates every 2 seconds • Live data
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



