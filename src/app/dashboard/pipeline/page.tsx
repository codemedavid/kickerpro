'use client';

// import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  DollarSign, 
  Users,
  Plus,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
// import { cn } from '@/lib/utils';

interface PipelineStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
  color: string;
  is_active: boolean;
}

interface Opportunity {
  id: string;
  stage_id: string;
  contact_name: string;
  contact_id: string;
  title: string;
  value: number;
  currency: string;
  probability: number;
  status: 'open' | 'won' | 'lost';
  expected_close_date: string | null;
  created_at: string;
}

export default function PipelinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Fetch pipeline stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/stages');
      if (!response.ok) throw new Error('Failed to fetch stages');
      const data = await response.json();
      return data.stages || [];
    },
    enabled: !!user?.id
  });

  // Fetch opportunities
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<Opportunity[]>({
    queryKey: ['opportunities', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/opportunities');
      if (!response.ok) throw new Error('Failed to fetch opportunities');
      const data = await response.json();
      return data.opportunities || [];
    },
    enabled: !!user?.id
  });

  // Move opportunity to different stage
  const moveStageMutation = useMutation({
    mutationFn: async ({ opportunityId, newStageId }: { opportunityId: string; newStageId: string }) => {
      const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: newStageId })
      });
      if (!response.ok) throw new Error('Failed to move opportunity');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({
        title: "Stage Updated",
        description: "Opportunity moved to new stage successfully."
      });
    }
  });

  // Group opportunities by stage
  const opportunitiesByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = opportunities.filter(opp => opp.stage_id === stage.id && opp.status === 'open');
    return acc;
  }, {} as Record<string, Opportunity[]>);

  // Calculate stats
  const totalOpportunities = opportunities.filter(o => o.status === 'open').length;
  const totalValue = opportunities
    .filter(o => o.status === 'open')
    .reduce((sum, o) => sum + Number(o.value), 0);
  const wonOpportunities = opportunities.filter(o => o.status === 'won').length;
  const weightedValue = opportunities
    .filter(o => o.status === 'open')
    .reduce((sum, o) => sum + (Number(o.value) * o.probability / 100), 0);

  const handleMoveStage = (opportunityId: string, direction: 'forward' | 'backward') => {
    const opportunity = opportunities.find(o => o.id === opportunityId);
    if (!opportunity) return;

    const currentStage = stages.find(s => s.id === opportunity.stage_id);
    if (!currentStage) return;

    const newOrder = direction === 'forward' 
      ? currentStage.stage_order + 1 
      : currentStage.stage_order - 1;

    const newStage = stages.find(s => s.stage_order === newOrder);
    if (newStage) {
      moveStageMutation.mutate({ opportunityId, newStageId: newStage.id });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Track customer stages and opportunities
          </p>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/pipeline/new')}
          className="bg-[#1877f2] hover:bg-[#166fe5]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Opportunity
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Opportunities</p>
                <p className="text-3xl font-bold mt-2">{totalOpportunities}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
                <p className="text-3xl font-bold mt-2">${totalValue.toLocaleString()}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Weighted Value</p>
                <p className="text-3xl font-bold mt-2">${Math.round(weightedValue).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Based on probability</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deals Closed</p>
                <p className="text-3xl font-bold mt-2">{wonOpportunities}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Kanban Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
          {stagesLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-80">
                <Skeleton className="h-96" />
              </div>
            ))
          ) : stages.filter(s => s.is_active).map((stage) => {
            const stageOpportunities = opportunitiesByStage[stage.id] || [];
            const stageValue = stageOpportunities.reduce((sum, o) => sum + Number(o.value), 0);

            return (
              <Card 
                key={stage.id} 
                className="w-80 flex-shrink-0"
                style={{ borderTopColor: stage.color, borderTopWidth: '4px' }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{stage.name}</CardTitle>
                    <Badge variant="secondary">{stageOpportunities.length}</Badge>
                  </div>
                  {stageValue > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ${stageValue.toLocaleString()}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                  {stageOpportunities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No opportunities in this stage
                    </div>
                  ) : (
                    stageOpportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push(`/dashboard/pipeline/${opp.id}`)}
                      >
                        <h4 className="font-semibold text-sm mb-1">{opp.title}</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          {opp.contact_name}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-green-600">
                            ${Number(opp.value).toLocaleString()}
                          </span>
                          {opp.probability > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {opp.probability}% likely
                            </Badge>
                          )}
                        </div>

                        {opp.expected_close_date && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Close: {format(parseISO(opp.expected_close_date), 'MMM dd, yyyy')}
                          </p>
                        )}

                        {/* Stage Movement Buttons */}
                        <div className="flex gap-1 mt-3">
                          {stage.stage_order > 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStage(opp.id, 'backward');
                              }}
                              className="flex-1 h-7 text-xs"
                              disabled={moveStageMutation.isPending}
                            >
                              ← Back
                            </Button>
                          )}
                          {stage.stage_order < stages.length && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStage(opp.id, 'forward');
                              }}
                              className="flex-1 h-7 text-xs"
                              disabled={moveStageMutation.isPending}
                            >
                              Next →
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {!stagesLoading && !opportunitiesLoading && opportunities.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Opportunities Yet</h3>
            <p className="text-muted-foreground mb-6">
              Start tracking your sales opportunities from your Facebook Messenger conversations
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => router.push('/dashboard/conversations')}
                variant="outline"
              >
                View Conversations
              </Button>
              <Button 
                onClick={() => router.push('/dashboard/pipeline/new')}
                className="bg-[#1877f2] hover:bg-[#166fe5]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Opportunity
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

