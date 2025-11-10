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
  Trash2,
  Search,
  X,
  UserPlus,
  GripVertical
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Checkbox } from '@/components/ui/checkbox';
import { CSS } from '@dnd-kit/utilities';
import { GeminiQuotaIndicator } from '@/components/GeminiQuotaIndicator';

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

// Droppable stage zone component
function DroppableStageZone({ 
  children, 
  stageId, 
  isOver 
}: { 
  children: React.ReactNode; 
  stageId: string;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `stage-${stageId}`,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`space-y-2 max-h-96 overflow-y-auto min-h-[100px] p-2 rounded-lg ${
        isOver ? 'bg-blue-50' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Draggable contact card component
function DraggableContactCard({
  opportunity,
  isSelected,
  isDragging,
  onToggleSelect,
  onMove,
}: {
  opportunity: PipelineOpportunity;
  isSelected: boolean;
  isDragging: boolean;
  onToggleSelect: () => void;
  onMove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: opportunity.id,
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded-lg border bg-card transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="mt-1"
          onClick={(e) => e.stopPropagation()}
        />
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <Avatar className="w-8 h-8">
          <AvatarFallback>
            {(opportunity.sender_name || 'U')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm break-words line-clamp-1" title={opportunity.sender_name || 'Unknown'}>
            {opportunity.sender_name || 'Unknown'}
          </p>
          {opportunity.conversation.last_message && (
            <p className="text-xs text-muted-foreground line-clamp-2 break-words" title={opportunity.conversation.last_message}>
              {opportunity.conversation.last_message}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {opportunity.ai_analyzed_at && (
              <Badge 
                variant={opportunity.both_prompts_agreed ? "default" : "secondary"}
                className="text-xs"
              >
                {opportunity.both_prompts_agreed ? (
                  <>✓ Agreed</>
                ) : (
                  <>⚠ Manual</>
                )}
              </Badge>
            )}
            {opportunity.manually_assigned && (
              <Badge variant="outline" className="text-xs">
                Manual
              </Badge>
            )}
            {opportunity.ai_confidence_score !== null && (
              <span className="text-xs text-muted-foreground">
                {Math.round(opportunity.ai_confidence_score * 100)}%
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
        >
          <MoveRight className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

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
  const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false);
  const [selectedStageForAdd, setSelectedStageForAdd] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<PipelineStage | null>(null);
  const [isStageExpandedDialogOpen, setIsStageExpandedDialogOpen] = useState(false);
  
  // Search states per stage
  const [stageSearchQueries, setStageSearchQueries] = useState<Record<string, string>>({});
  
  // Multi-select and drag states
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Form states
  const [stageName, setStageName] = useState('');
  const [stageDescription, setStageDescription] = useState('');
  const [stageColor, setStageColor] = useState('#3b82f6');
  const [stagePrompt, setStagePrompt] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const data = await response.json();
      
      // If no stages exist, create a default stage
      if (data.stages && data.stages.length === 0) {
        const createResponse = await fetch('/api/pipeline/stages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Unmatched',
            description: 'Contacts that need manual review or AI analysis',
            color: '#94a3b8',
            analysis_prompt: 'Review this contact manually to determine the appropriate stage. Consider their engagement level, conversation history, and intent.',
            is_default: true,
            position: 999
          })
        });
        
        if (createResponse.ok) {
          const createData = await createResponse.json();
          return { stages: [createData.stage] };
        }
      }
      
      return data;
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

  // Batch move opportunities mutation
  const batchMoveOpportunitiesMutation = useMutation({
    mutationFn: async (data: { opportunityIds: string[]; stageId: string }) => {
      const results = await Promise.all(
        data.opportunityIds.map(async (opportunityId) => {
          const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage_id: data.stageId, manually_assigned: true })
          });
          if (!response.ok) {
            throw new Error('Failed to move opportunity');
          }
          return response.json();
        })
      );
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-opportunities'] });
      toast({ 
        title: 'Contacts moved successfully',
        description: `${variables.opportunityIds.length} contact${variables.opportunityIds.length !== 1 ? 's' : ''} moved`
      });
      setSelectedContacts(new Set());
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Remove opportunity mutation
  const removeOpportunityMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove contact');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-opportunities'] });
      toast({ title: 'Contact removed from pipeline' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Fetch available conversations to add
  const { data: conversationsData } = useQuery<{ conversations: Array<{ 
    id: string; 
    sender_id: string; 
    sender_name: string | null; 
    last_message: string | null;
  }> }>({
    queryKey: ['available-conversations'],
    queryFn: async () => {
      const response = await fetch('/api/conversations?limit=100');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    enabled: isAddContactDialogOpen && !!user?.id
  });

  // Add contact to pipeline mutation
  const addContactToPipelineMutation = useMutation({
    mutationFn: async (data: { conversationId: string; stageId: string }) => {
      const response = await fetch('/api/pipeline/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add contact');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-opportunities'] });
      toast({ title: 'Contact added to pipeline' });
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

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // If dragging a contact that's not in the selection, clear selection and select only this one
    if (!selectedContacts.has(active.id as string)) {
      setSelectedContacts(new Set([active.id as string]));
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    // Check if dropping over a stage (stage IDs are in the format "stage-{stageId}")
    const overStageId = (over.id as string).startsWith('stage-') 
      ? (over.id as string).replace('stage-', '')
      : null;

    if (overStageId) {
      // Get all selected opportunity IDs or just the active one
      const contactsToMove = selectedContacts.size > 0 
        ? Array.from(selectedContacts)
        : [active.id as string];

      // Move all selected contacts
      if (contactsToMove.length > 1) {
        batchMoveOpportunitiesMutation.mutate({
          opportunityIds: contactsToMove,
          stageId: overStageId
        });
      } else if (contactsToMove.length === 1) {
        moveOpportunityMutation.mutate({
          opportunityId: contactsToMove[0],
          stageId: overStageId
        });
      }
    }

    setActiveId(null);
    setOverId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const toggleContactSelection = (opportunityId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(opportunityId)) {
      newSelection.delete(opportunityId);
    } else {
      newSelection.add(opportunityId);
    }
    setSelectedContacts(newSelection);
  };

  const handleStageSearch = (stageId: string, query: string) => {
    setStageSearchQueries(prev => ({ ...prev, [stageId]: query }));
  };

  const filterOpportunitiesBySearch = (opps: PipelineOpportunity[], stageId: string) => {
    const searchQuery = stageSearchQueries[stageId]?.toLowerCase() || '';
    if (!searchQuery) return opps;
    
    return opps.filter(opp => 
      opp.sender_name?.toLowerCase().includes(searchQuery) ||
      opp.conversation.last_message?.toLowerCase().includes(searchQuery)
    );
  };

  const handleAddContact = (stageId: string) => {
    setSelectedStageForAdd(stageId);
    setIsAddContactDialogOpen(true);
  };

  const handleExpandStage = (stage: PipelineStage) => {
    setExpandedStage(stage);
    setIsStageExpandedDialogOpen(true);
  };

  // Group opportunities by stage
  const opportunitiesByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = opportunities.filter(opp => opp.stage_id === stage.id);
    return acc;
  }, {} as Record<string, PipelineOpportunity[]>);

  // Available conversations to add (exclude ones already in pipeline)
  const availableConversations = conversationsData?.conversations.filter(
    conv => !opportunities.some(opp => opp.conversation_id === conv.id)
  ) || [];

  const totalContacts = opportunities.length;
  const analyzedCount = opportunities.filter(o => o.ai_analyzed_at).length;
  const agreedCount = opportunities.filter(o => o.both_prompts_agreed).length;

  // Get active opportunity for drag overlay
  const activeOpportunity = activeId ? opportunities.find(o => o.id === activeId) : null;
  const selectedCount = selectedContacts.size;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
        <div className="flex items-start gap-3">
          <GeminiQuotaIndicator />
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
      {stages.length === 1 && stages[0]?.is_default && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-2xl">
                🚀
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 text-lg mb-2">Get Started with Your Sales Pipeline</h3>
                <p className="text-sm text-blue-800 mb-4">
                  Your default <strong>&quot;Unmatched&quot;</strong> stage is ready! Contacts added to the pipeline will automatically go here until categorized.
                </p>
                <div className="bg-white/60 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Quick Setup Guide:</p>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">1.</span>
                      <span>Click <strong>&quot;Pipeline Settings&quot;</strong> to configure global AI analysis</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">2.</span>
                      <span>Click <strong>&quot;Add Stage&quot;</strong> to create stages (Lead, Qualified, Won)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">3.</span>
                      <span>Go to <strong>Conversations</strong> and select contacts to add</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">4.</span>
                      <span>Use <strong>&quot;Analyze All&quot;</strong> to let AI auto-categorize contacts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected contacts info banner */}
      {selectedCount > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600">
                  {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
                </Badge>
                <p className="text-sm text-blue-800">
                  Drag selected contacts to a stage or use actions below
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Remove ${selectedCount} contact${selectedCount !== 1 ? 's' : ''} from pipeline?`)) {
                      const contactIds = Array.from(selectedContacts);
                      Promise.all(
                        contactIds.map(id => removeOpportunityMutation.mutateAsync(id))
                      ).then(() => {
                        setSelectedContacts(new Set());
                        toast({ 
                          title: 'Contacts removed',
                          description: `${selectedCount} contact${selectedCount !== 1 ? 's' : ''} removed from pipeline`
                        });
                      });
                    }
                  }}
                >
                  <Trash2 className="mr-2 w-4 h-4" />
                  Remove Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContacts(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
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
            const allStageOpportunities = opportunitiesByStage[stage.id] || [];
            const filteredOpportunities = filterOpportunitiesBySearch(allStageOpportunities, stage.id);
            const isOverStage = overId === `stage-${stage.id}`;
            
            return (
              <div
                key={stage.id}
                id={`stage-${stage.id}`}
                className={`transition-all ${isOverStage ? 'scale-105' : ''}`}
              >
                <Card 
                  className={`border-2 ${isOverStage ? 'ring-4 ring-blue-400' : ''} ${stage.is_default ? 'bg-slate-50/50' : ''}`}
                  style={{ borderColor: isOverStage ? '#3b82f6' : stage.color }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div 
                        className="flex-1 cursor-pointer hover:opacity-75 transition-opacity min-w-0"
                        onClick={() => handleExpandStage(stage)}
                      >
                        <div className="flex items-center justify-between gap-2 w-full mb-1">
                          <CardTitle className="text-base flex items-center gap-2 flex-1 min-w-0">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="break-words line-clamp-2" title={stage.name}>
                              {stage.name}
                            </span>
                          </CardTitle>
                          {stage.is_default && (
                            <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 flex-shrink-0">
                              Default
                            </Badge>
                          )}
                        </div>
                        {stage.description && (
                          <CardDescription className="text-xs line-clamp-2 break-words" title={stage.description}>
                            {stage.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStage(stage);
                        }}
                        className="h-8 w-8 p-0 flex-shrink-0"
                        title="Edit stage settings"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">
                        {allStageOpportunities.length} contact{allStageOpportunities.length !== 1 ? 's' : ''}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddContact(stage.id)}
                        className="h-7 px-2"
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    
                    {/* Search bar */}
                    <div className="mt-3 relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        placeholder="Search contacts..."
                        value={stageSearchQueries[stage.id] || ''}
                        onChange={(e) => handleStageSearch(stage.id, e.target.value)}
                        className="pl-7 pr-7 h-8 text-xs"
                      />
                      {stageSearchQueries[stage.id] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                          onClick={() => handleStageSearch(stage.id, '')}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <DroppableStageZone stageId={stage.id} isOver={isOverStage}>
                      {filteredOpportunities.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {stageSearchQueries[stage.id] 
                            ? 'No contacts match your search'
                            : 'No contacts in this stage'
                          }
                        </p>
                      ) : (
                        filteredOpportunities.map((opp) => (
                          <DraggableContactCard
                            key={opp.id}
                            opportunity={opp}
                            isSelected={selectedContacts.has(opp.id)}
                            isDragging={activeId === opp.id}
                            onToggleSelect={() => toggleContactSelection(opp.id)}
                            onMove={() => {
                              setSelectedOpportunity(opp);
                              setIsMoveDialogOpen(true);
                            }}
                          />
                        ))
                      )}
                    </DroppableStageZone>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOpportunity ? (
          <Card className="w-72 border-2 border-blue-500 shadow-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                {selectedCount > 1 ? (
                  <Badge className="bg-blue-600">
                    {selectedCount} contacts
                  </Badge>
                ) : (
                  <>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {(activeOpportunity.sender_name || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {activeOpportunity.sender_name || 'Unknown'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>

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

      {/* Add Contact to Pipeline Dialog */}
      <Dialog open={isAddContactDialogOpen} onOpenChange={setIsAddContactDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Contact to Pipeline</DialogTitle>
            <DialogDescription>
              Select a contact from your conversations to add to this stage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availableConversations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  All your conversations are already in the pipeline
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard/conversations')}
                >
                  Go to Conversations
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {availableConversations.length} conversation{availableConversations.length !== 1 ? 's' : ''} available
                </p>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {availableConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {(conv.sender_name || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {conv.sender_name || 'Unknown'}
                          </p>
                          {conv.last_message && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.last_message}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (selectedStageForAdd) {
                              addContactToPipelineMutation.mutate({
                                conversationId: conv.id,
                                stageId: selectedStageForAdd
                              });
                            }
                          }}
                          disabled={addContactToPipelineMutation.isPending}
                        >
                          {addContactToPipelineMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Add'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Stage View Dialog */}
      <Dialog open={isStageExpandedDialogOpen} onOpenChange={setIsStageExpandedDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {expandedStage && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-6 h-6 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: expandedStage.color }}
                  />
                  <div className="flex-1">
                    <DialogTitle className="text-2xl">{expandedStage.name}</DialogTitle>
                    {expandedStage.description && (
                      <DialogDescription className="mt-1">
                        {expandedStage.description}
                      </DialogDescription>
                    )}
                  </div>
                  {expandedStage.is_default && (
                    <Badge variant="outline">Default</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Stats and Actions */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Contacts</p>
                      <p className="text-2xl font-bold">
                        {(opportunitiesByStage[expandedStage.id] || []).length}
                      </p>
                    </div>
                    <div className="h-12 w-px bg-border" />
                    <div>
                      <p className="text-sm text-muted-foreground">AI Analyzed</p>
                      <p className="text-2xl font-bold">
                        {(opportunitiesByStage[expandedStage.id] || []).filter(o => o.ai_analyzed_at).length}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleAddContact(expandedStage.id);
                        setIsStageExpandedDialogOpen(false);
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleEditStage(expandedStage);
                        setIsStageExpandedDialogOpen(false);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Stage
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts in this stage..."
                    value={stageSearchQueries[expandedStage.id] || ''}
                    onChange={(e) => handleStageSearch(expandedStage.id, e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Contacts List */}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {(() => {
                    const stageOpps = opportunitiesByStage[expandedStage.id] || [];
                    const filteredOpps = filterOpportunitiesBySearch(stageOpps, expandedStage.id);
                    
                    return filteredOpps.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          {stageSearchQueries[expandedStage.id] 
                            ? 'No contacts match your search'
                            : 'No contacts in this stage'
                          }
                        </p>
                      </div>
                    ) : (
                      filteredOpps.map((opp) => (
                        <div
                          key={opp.id}
                          className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedContacts.has(opp.id)}
                              onCheckedChange={() => toggleContactSelection(opp.id)}
                            />
                            <Avatar className="w-10 h-10">
                              <AvatarFallback>
                                {(opp.sender_name || 'U')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{opp.sender_name || 'Unknown'}</p>
                              {opp.conversation.last_message && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {opp.conversation.last_message}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {opp.ai_analyzed_at && (
                                  <Badge 
                                    variant={opp.both_prompts_agreed ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {opp.both_prompts_agreed ? '✓ Agreed' : '⚠ Manual'}
                                  </Badge>
                                )}
                                {opp.manually_assigned && (
                                  <Badge variant="outline" className="text-xs">Manual</Badge>
                                )}
                                {opp.ai_confidence_score !== null && (
                                  <Badge variant="secondary" className="text-xs">
                                    {Math.round(opp.ai_confidence_score * 100)}% confidence
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Added {format(new Date(opp.moved_to_stage_at), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOpportunity(opp);
                                setIsMoveDialogOpen(true);
                                setIsStageExpandedDialogOpen(false);
                              }}
                            >
                              <MoveRight className="w-4 h-4 mr-2" />
                              Move
                            </Button>
                          </div>
                        </div>
                      ))
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </DndContext>
  );
}

