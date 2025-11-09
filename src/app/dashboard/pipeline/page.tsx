'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  GitBranch, 
  Plus,
  Settings,
  Loader2,
  Sparkles,
  UserCircle,
  MessageSquare,
  Calendar,
  ChevronRight,
  MoveRight,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PipelineStage {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  analysis_prompt: string;
  is_default: boolean;
  is_active: boolean;
}

interface PipelineOpportunity {
  id: string;
  conversation_id: string;
  stage_id: string;
  sender_id: string;
  sender_name: string | null;
  ai_confidence_score: number | null;
  both_prompts_agreed: boolean | null;
  manually_assigned: boolean;
  moved_to_stage_at: string;
  ai_analyzed_at: string | null;
  stage: PipelineStage;
  conversation: {
    last_message: string | null;
    last_message_time: string;
  };
}

interface PipelineSettings {
  global_analysis_prompt: string;
  auto_analyze: boolean;
}

const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#94a3b8', label: 'Gray' }
];

export default function PipelinePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<PipelineOpportunity | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);

  // Form states
  const [stageName, setStageName] = useState('');
  const [stageDescription, setStageDescription] = useState('');
  const [stageColor, setStageColor] = useState('#3b82f6');
  const [stagePrompt, setStagePrompt] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');

  // Fetch pipeline settings
  const { data: settingsData } = useQuery<{ settings: PipelineSettings; isNew: boolean }>({
    queryKey: ['pipeline-settings'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch pipeline stages
  const { data: stagesData, isLoading: stagesLoading } = useQuery<{ stages: PipelineStage[] }>({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/stages');
      if (!response.ok) throw new Error('Failed to fetch stages');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch pipeline opportunities
  const { data: opportunitiesData, isLoading: oppsLoading } = useQuery<{ opportunities: PipelineOpportunity[] }>({
    queryKey: ['pipeline-opportunities'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/opportunities');
      if (!response.ok) throw new Error('Failed to fetch opportunities');
      return response.json();
    },
    enabled: !!user?.id
  });

  const stages = stagesData?.stages || [];
  const opportunities = opportunitiesData?.opportunities || [];

  // Create stage mutation
  const createStageMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; color: string; analysis_prompt: string }) => {
      const response = await fetch('/api/pipeline/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create stage');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      toast({ title: 'Stage created successfully' });
      setIsStageDialogOpen(false);
      resetStageForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; color: string; analysis_prompt: string }) => {
      const response = await fetch('/api/pipeline/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update stage');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      toast({ title: 'Stage updated successfully' });
      setIsStageDialogOpen(false);
      resetStageForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { global_analysis_prompt: string }) => {
      const response = await fetch('/api/pipeline/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-settings'] });
      toast({ title: 'Settings saved successfully' });
      setIsSettingsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Move opportunity mutation
  const moveOpportunityMutation = useMutation({
    mutationFn: async (data: { opportunityId: string; stageId: string }) => {
      const response = await fetch(`/api/pipeline/opportunities/${data.opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: data.stageId, manually_assigned: true })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to move opportunity');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-opportunities'] });
      toast({ title: 'Contact moved successfully' });
      setIsMoveDialogOpen(false);
      setSelectedOpportunity(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleAnalyzeAll = async () => {
    if (!settingsData?.settings?.global_analysis_prompt) {
      toast({
        title: 'Settings Required',
        description: 'Please configure global analysis prompt first',
        variant: 'destructive'
      });
      setIsSettingsOpen(true);
      return;
    }

    if (stages.length === 0) {
      toast({
        title: 'No Stages',
        description: 'Please create at least one pipeline stage first',
        variant: 'destructive'
      });
      return;
    }

    if (opportunities.length === 0) {
      toast({
        title: 'No Contacts',
        description: 'Add contacts to the pipeline first from the Conversations page',
        variant: 'destructive'
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const opportunityIds = opportunities.map(o => o.id);

      const response = await fetch('/api/pipeline/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_ids: opportunityIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze contacts');
      }

      const result = await response.json();

      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${result.analyzed} contact${result.analyzed !== 1 ? 's' : ''}`
      });

      queryClient.invalidateQueries({ queryKey: ['pipeline-opportunities'] });
    } catch (error) {
      console.error('[Pipeline] Error analyzing:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to analyze contacts',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetStageForm = () => {
    setStageName('');
    setStageDescription('');
    setStageColor('#3b82f6');
    setStagePrompt('');
    setEditingStage(null);
  };

  const handleEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageDescription(stage.description || '');
    setStageColor(stage.color);
    setStagePrompt(stage.analysis_prompt);
    setIsStageDialogOpen(true);
  };

  const handleSaveStage = () => {
    if (!stageName.trim() || !stagePrompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Stage name and analysis prompt are required',
        variant: 'destructive'
      });
      return;
    }

    const data = {
      name: stageName,
      description: stageDescription,
      color: stageColor,
      analysis_prompt: stagePrompt
    };

    if (editingStage) {
      updateStageMutation.mutate({ ...data, id: editingStage.id });
    } else {
      createStageMutation.mutate(data);
    }
  };

  const handleSaveSettings = () => {
    if (!globalPrompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Global analysis prompt is required',
        variant: 'destructive'
      });
      return;
    }

    saveSettingsMutation.mutate({ global_analysis_prompt: globalPrompt });
  };

  // Group opportunities by stage
  const opportunitiesByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = opportunities.filter(opp => opp.stage_id === stage.id);
    return acc;
  }, {} as Record<string, PipelineOpportunity[]>);

  const totalContacts = opportunities.length;
  const analyzedCount = opportunities.filter(o => o.ai_analyzed_at).length;
  const agreedCount = opportunities.filter(o => o.both_prompts_agreed).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="w-8 h-8" />
            Sales Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered contact stage management
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setGlobalPrompt(settingsData?.settings?.global_analysis_prompt || '');
              setIsSettingsOpen(true);
            }}
          >
            <Settings className="mr-2 w-4 h-4" />
            Pipeline Settings
          </Button>
          <Button
            onClick={() => {
              resetStageForm();
              setIsStageDialogOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 w-4 h-4" />
            Add Stage
          </Button>
          <Button
            onClick={handleAnalyzeAll}
            disabled={isAnalyzing || opportunities.length === 0}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 w-4 h-4" />
                Analyze All Contacts
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-3xl font-bold mt-2">{totalContacts}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <UserCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Analyzed</p>
                <p className="text-3xl font-bold mt-2">{analyzedCount}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prompts Agreed</p>
                <p className="text-3xl font-bold mt-2">{agreedCount}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <GitBranch className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup Instructions */}
      {stages.length === 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 mb-2">🚀 Get Started with Pipeline</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Click &quot;Pipeline Settings&quot; to configure your global analysis instructions</li>
              <li>Click &quot;Add Stage&quot; to create your first pipeline stage</li>
              <li>Go to Conversations page and select contacts to add to pipeline</li>
              <li>Click &quot;Analyze All Contacts&quot; to let AI categorize them</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Stages */}
      {stagesLoading || oppsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : stages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stages.map((stage) => {
            const stageOpportunities = opportunitiesByStage[stage.id] || [];
            
            return (
              <Card key={stage.id} className="border-2" style={{ borderColor: stage.color }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                        {stage.is_default && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </CardTitle>
                      {stage.description && (
                        <CardDescription className="mt-1 text-xs">
                          {stage.description}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditStage(stage)}
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {stageOpportunities.length} contact{stageOpportunities.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {stageOpportunities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No contacts in this stage
                      </p>
                    ) : (
                      stageOpportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => {
                            setSelectedOpportunity(opp);
                            setIsMoveDialogOpen(true);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>
                                {(opp.sender_name || 'U')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {opp.sender_name || 'Unknown'}
                              </p>
                              {opp.conversation.last_message && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {opp.conversation.last_message}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {opp.ai_analyzed_at && (
                                  <Badge 
                                    variant={opp.both_prompts_agreed ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {opp.both_prompts_agreed ? (
                                      <>✓ Agreed</>
                                    ) : (
                                      <>⚠ Manual</>
                                    )}
                                  </Badge>
                                )}
                                {opp.manually_assigned && (
                                  <Badge variant="outline" className="text-xs">
                                    Manual
                                  </Badge>
                                )}
                                {opp.ai_confidence_score !== null && (
                                  <span className="text-xs text-muted-foreground">
                                    {Math.round(opp.ai_confidence_score * 100)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Pipeline Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pipeline Settings</DialogTitle>
            <DialogDescription>
              Configure global instructions for AI to analyze contacts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="global-prompt">Global Analysis Prompt</Label>
              <Textarea
                id="global-prompt"
                value={globalPrompt}
                onChange={(e) => setGlobalPrompt(e.target.value)}
                placeholder="Example: Analyze this contact based on their conversation history. Consider their engagement level, purchase intent, and where they are in the buying journey. Categorize them into the most appropriate stage based on these factors..."
                className="mt-2 min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-2">
                This prompt will be used alongside stage-specific prompts to determine the best stage for each contact.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Stage Dialog */}
      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Edit Stage' : 'Add New Stage'}</DialogTitle>
            <DialogDescription>
              Define a stage in your sales pipeline with AI analysis criteria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="stage-name">Stage Name</Label>
              <Input
                id="stage-name"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g., Lead, Qualified, Negotiation, Closed"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="stage-description">Description (Optional)</Label>
              <Input
                id="stage-description"
                value={stageDescription}
                onChange={(e) => setStageDescription(e.target.value)}
                placeholder="Brief description of this stage"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="stage-color">Color</Label>
              <Select value={stageColor} onValueChange={setStageColor}>
                <SelectTrigger id="stage-color" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stage-prompt">Stage Analysis Prompt</Label>
              <Textarea
                id="stage-prompt"
                value={stagePrompt}
                onChange={(e) => setStagePrompt(e.target.value)}
                placeholder="Example: A contact belongs in this stage if they have shown strong purchase intent, asked about pricing, and are actively engaged in the last 7 days..."
                className="mt-2 min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Define specific criteria for contacts to be placed in this stage. AI will use this alongside the global prompt.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsStageDialogOpen(false);
                  resetStageForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveStage}
                disabled={createStageMutation.isPending || updateStageMutation.isPending}
              >
                {(createStageMutation.isPending || updateStageMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingStage ? 'Update Stage' : 'Create Stage'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Contact Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Contact to Different Stage</DialogTitle>
            <DialogDescription>
              Manually assign {selectedOpportunity?.sender_name || 'this contact'} to a stage
            </DialogDescription>
          </DialogHeader>
          {selectedOpportunity && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar>
                    <AvatarFallback>
                      {(selectedOpportunity.sender_name || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedOpportunity.sender_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      Currently in: {selectedOpportunity.stage.name}
                    </p>
                  </div>
                </div>
                {selectedOpportunity.conversation.last_message && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Last message:</p>
                    <p className="italic">&quot;{selectedOpportunity.conversation.last_message}&quot;</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(selectedOpportunity.conversation.last_message_time), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label>Select New Stage</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {stages.filter(s => s.id !== selectedOpportunity.stage_id).map((stage) => (
                    <Button
                      key={stage.id}
                      variant="outline"
                      className="h-auto py-3 justify-start"
                      onClick={() => {
                        moveOpportunityMutation.mutate({
                          opportunityId: selectedOpportunity.id,
                          stageId: stage.id
                        });
                      }}
                      disabled={moveOpportunityMutation.isPending}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-left">{stage.name}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

