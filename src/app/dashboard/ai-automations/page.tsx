'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Bot, Clock, Zap, Trash2, Play, Pencil, Activity } from 'lucide-react';
import { TagSelector } from '@/components/ui/tag-selector';
import { AutomationLiveMonitor } from '@/components/automation-live-monitor';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  time_interval_minutes: number | null;
  time_interval_hours: number | null;
  time_interval_days: number | null;
  max_follow_ups: number | null;
  follow_up_sequence: Array<{ minutes?: number; hours?: number; days?: number }> | null;
  stop_on_reply: boolean;
  remove_tag_on_reply: string | null;
  page_id: string | null;
  include_tag_ids: string[];
  exclude_tag_ids: string[];
  custom_prompt: string;
  language_style: string;
  message_tag: string;
  max_messages_per_day: number;
  active_hours_start: number;
  active_hours_end: number;
  active_hours_start_minutes: number;
  active_hours_end_minutes: number;
  run_24_7: boolean;
  last_executed_at: string | null;
  execution_count: number;
  success_count: number;
  created_at: string;
}

export default function AIAutomationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [monitoringRule, setMonitoringRule] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    enabled: boolean;
    time_interval_minutes: number | null;
    time_interval_hours: number | null;
    time_interval_days: number | null;
    max_follow_ups: number | null;
    follow_up_sequence: Array<{ minutes?: number; hours?: number; days?: number }> | null;
    stop_on_reply: boolean;
    remove_tag_on_reply: string | null;
    custom_prompt: string;
    language_style: string;
    message_tag: string;
    max_messages_per_day: number;
    active_hours_start: number;
    active_hours_end: number;
    active_hours_start_minutes: number;
    active_hours_end_minutes: number;
    run_24_7: boolean;
    include_tag_ids: string[];
    exclude_tag_ids: string[];
  }>({
    name: '',
    description: '',
    enabled: true,
    time_interval_minutes: null,
    time_interval_hours: 24,
    time_interval_days: null,
    max_follow_ups: null,
    follow_up_sequence: null,
    stop_on_reply: true,
    remove_tag_on_reply: null,
    custom_prompt: '',
    language_style: 'taglish',
    message_tag: 'ACCOUNT_UPDATE',
    max_messages_per_day: 100,
    active_hours_start: 9,
    active_hours_end: 21,
    active_hours_start_minutes: 0,
    active_hours_end_minutes: 0,
    run_24_7: false,
    include_tag_ids: [],
    exclude_tag_ids: []
  });

  // Fetch automation rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['ai-automations'],
    queryFn: async () => {
      const response = await fetch('/api/ai-automations');
      if (!response.ok) throw new Error('Failed to fetch automation rules');
      return response.json();
    }
  });

  const rules: AutomationRule[] = rulesData?.rules || [];

  // Create automation rule
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log('📤 Sending automation data:', data);
      
      const response = await fetch('/api/ai-automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ API ERROR RESPONSE:', error);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        
        // Show detailed error info
        if (error.errorCode) {
          console.error('❌ Error Code:', error.errorCode);
          console.error('❌ Error Message:', error.errorMessage);
          console.error('❌ Error Details:', error.errorDetails);
          console.error('❌ Error Hint:', error.errorHint);
          console.error('❌ Debug Info:', error.debugInfo);
        }
        
        // Throw with full context
        throw new Error(JSON.stringify(error, null, 2));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        enabled: true,
        time_interval_minutes: null,
        time_interval_hours: 24,
        time_interval_days: null,
        max_follow_ups: null,
        follow_up_sequence: null,
        stop_on_reply: true,
        remove_tag_on_reply: null,
        custom_prompt: '',
        language_style: 'taglish',
        message_tag: 'ACCOUNT_UPDATE',
        max_messages_per_day: 100,
        active_hours_start: 9,
        active_hours_end: 21,
        active_hours_start_minutes: 0,
        active_hours_end_minutes: 0,
        run_24_7: false,
        include_tag_ids: [],
        exclude_tag_ids: []
      });
      toast({
        title: "Automation Created!",
        description: "AI automation rule created successfully"
      });
    },
    onError: (error: Error) => {
      console.error('❌ AUTOMATION CREATION ERROR:', error);
      console.error('❌ Error message:', error.message);
      
      // Try to parse detailed error if it's a JSON response
      try {
        const errorData = JSON.parse(error.message.replace('Error: ', ''));
        console.error('❌ DETAILED ERROR INFO:', errorData);
        
        // Show detailed error in console
        if (errorData.errorCode === '42703') {
          console.error('❌ DATABASE SCHEMA ERROR: Column does not exist');
          console.error('   Fix: Run database migration fix-database-schema.sql');
        } else if (errorData.errorCode === '42501') {
          console.error('❌ PERMISSION ERROR: RLS policy blocking');
          console.error('   Fix: Check Supabase RLS policies');
        }
        
        toast({
          title: "Error",
          description: `${errorData.errorMessage || error.message}\n\nCheck browser console (F12) for details`,
          variant: "destructive",
          duration: 10000
        });
      } catch {
        toast({
          title: "Error",
          description: error.message || "Failed to create automation rule",
          variant: "destructive",
          duration: 6000
        });
      }
    }
  });

  // Update automation rule
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      console.log('📝 Updating automation:', id, data);
      
      const response = await fetch(`/api/ai-automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Update error:', error);
        throw new Error(error.error || 'Failed to update rule');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      setIsEditDialogOpen(false);
      setEditingRule(null);
      resetForm();
      toast({
        title: "Updated! ✏️",
        description: "Automation rule updated successfully"
      });
    },
    onError: (error: Error) => {
      console.error('❌ Update failed:', error);
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete automation rule
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/ai-automations/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      toast({
        title: "Deleted",
        description: "Automation rule deleted successfully"
      });
    }
  });

  // Manual trigger for testing
  const triggerMutation = useMutation({
    mutationFn: async (ruleId?: string) => {
      const response = await fetch('/api/ai-automations/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger automation');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      toast({
        title: "Automation Triggered!",
        description: `Generated ${data.summary.total_messages_generated} messages, sent ${data.summary.total_messages_sent}`,
        duration: 5000
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle enabled status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch(`/api/ai-automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) throw new Error('Failed to update rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automations'] });
      toast({
        title: "Updated",
        description: "Automation rule updated"
      });
    }
  });

  // Reset form to default values
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      time_interval_minutes: null,
      time_interval_hours: 24,
      time_interval_days: null,
      max_follow_ups: null,
      follow_up_sequence: null,
      stop_on_reply: true,
      remove_tag_on_reply: null,
      custom_prompt: '',
      language_style: 'taglish',
      message_tag: 'ACCOUNT_UPDATE',
      max_messages_per_day: 100,
      active_hours_start: 9,
      active_hours_end: 21,
      active_hours_start_minutes: 0,
      active_hours_end_minutes: 0,
      run_24_7: false,
      include_tag_ids: [],
      exclude_tag_ids: []
    });
  };

  // Open edit dialog with existing rule data
  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      enabled: rule.enabled,
      time_interval_minutes: rule.time_interval_minutes,
      time_interval_hours: rule.time_interval_hours,
      time_interval_days: rule.time_interval_days,
      max_follow_ups: rule.max_follow_ups,
      follow_up_sequence: rule.follow_up_sequence,
      stop_on_reply: rule.stop_on_reply,
      remove_tag_on_reply: rule.remove_tag_on_reply,
      custom_prompt: rule.custom_prompt || '',
      language_style: rule.language_style || 'taglish',
      message_tag: rule.message_tag || 'ACCOUNT_UPDATE',
      max_messages_per_day: rule.max_messages_per_day || 100,
      active_hours_start: rule.active_hours_start || 9,
      active_hours_end: rule.active_hours_end || 21,
      active_hours_start_minutes: rule.active_hours_start_minutes || 0,
      active_hours_end_minutes: rule.active_hours_end_minutes || 0,
      run_24_7: rule.run_24_7 || false,
      include_tag_ids: rule.include_tag_ids || [],
      exclude_tag_ids: rule.exclude_tag_ids || []
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that include and exclude tags don't overlap
    const includeSet = new Set(formData.include_tag_ids);
    const overlappingTags = formData.exclude_tag_ids.filter(tagId => includeSet.has(tagId));
    
    if (overlappingTags.length > 0) {
      toast({
        title: "Validation Error",
        description: "Cannot include and exclude the same tag(s). Please remove duplicate tags from either Include or Exclude section.",
        variant: "destructive",
        duration: 6000
      });
      return;
    }
    
    // Check if we're editing or creating
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getIntervalDisplay = (rule: AutomationRule) => {
    if (rule.time_interval_minutes) {
      return `${rule.time_interval_minutes} min${rule.time_interval_minutes > 1 ? 's' : ''}`;
    }
    if (rule.time_interval_hours) {
      return `${rule.time_interval_hours} hour${rule.time_interval_hours > 1 ? 's' : ''}`;
    }
    if (rule.time_interval_days) {
      return `${rule.time_interval_days} day${rule.time_interval_days > 1 ? 's' : ''}`;
    }
    return 'Not set';
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Automations</h1>
          <p className="text-muted-foreground mt-2">
            Automatically send AI-generated personalized messages based on time intervals
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Plus className="mr-2 w-4 h-4" />
              Create Automation
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create AI Automation Rule</DialogTitle>
              <DialogDescription>
                Set up automatic AI message sending with custom prompts and time intervals
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Follow-up after 24 hours"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this automation do?"
                />
              </div>

              {/* Time Interval */}
              <div className="space-y-2">
                <Label>Follow-up Time Interval</Label>
                <p className="text-sm text-muted-foreground">Send message after this much time of inactivity</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minutes">Minutes</Label>
                  <Input
                    id="minutes"
                    type="number"
                    min="1"
                    max="1440"
                    value={formData.time_interval_minutes || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      time_interval_minutes: parseInt(e.target.value) || 0,
                      time_interval_hours: null,
                      time_interval_days: null
                    })}
                    placeholder="e.g., 30"
                  />
                  <p className="text-xs text-muted-foreground">Fast follow-ups</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    min="1"
                    max="999"
                    value={formData.time_interval_hours || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      time_interval_minutes: null,
                      time_interval_hours: parseInt(e.target.value) || 0,
                      time_interval_days: null
                    })}
                    placeholder="e.g., 24"
                  />
                  <p className="text-xs text-muted-foreground">Same day</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="days">Days</Label>
                  <Input
                    id="days"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.time_interval_days || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      time_interval_minutes: null,
                      time_interval_hours: null,
                      time_interval_days: parseInt(e.target.value) || 0
                    })}
                    placeholder="e.g., 7"
                  />
                  <p className="text-xs text-muted-foreground">Long-term</p>
                </div>
              </div>

              {/* Follow-up Limits */}
              <div className="space-y-2">
                <Label htmlFor="maxFollowUps">Maximum Follow-ups</Label>
                <Input
                  id="maxFollowUps"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.max_follow_ups || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    max_follow_ups: e.target.value ? parseInt(e.target.value) : null
                  })}
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  How many times to follow up per contact? (Empty = unlimited)
                </p>
              </div>

              {/* Stop on Reply */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Stop When Contact Replies</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically stop following up if they respond
                  </p>
                </div>
                <Switch
                  checked={formData.stop_on_reply}
                  onCheckedChange={(checked) => setFormData({ ...formData, stop_on_reply: checked })}
                />
              </div>

              {/* Remove Tag on Reply */}
              <div className="space-y-2">
                <Label>Auto-Remove Tag When Contact Replies (Optional)</Label>
                <TagSelector
                  selectedTagIds={formData.remove_tag_on_reply ? [formData.remove_tag_on_reply] : []}
                  onTagChange={(tagIds) => setFormData({ ...formData, remove_tag_on_reply: tagIds[0] || null })}
                />
                <p className="text-xs text-muted-foreground">
                  Remove this tag and stop automation when they reply
                </p>
              </div>

              {/* AI Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">AI Prompt Instructions *</Label>
                <Textarea
                  id="prompt"
                  value={formData.custom_prompt}
                  onChange={(e) => setFormData({ ...formData, custom_prompt: e.target.value })}
                  placeholder="Example:
Write in Taglish (mix Tagalog and English).
Reference their previous conversation.
Mention our new product/sale.
Casual friendly tone.
2-3 sentences.
Ask if they're still interested."
                  rows={8}
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Tell the AI how to compose messages for this automation
                </p>
              </div>

              {/* Tag Filters */}
              <div className="space-y-2">
                <Label>Include Conversations with Tags (Optional)</Label>
                <TagSelector
                  selectedTagIds={formData.include_tag_ids}
                  onTagChange={(tagIds) => setFormData({ ...formData, include_tag_ids: tagIds })}
                />
                <p className="text-xs text-muted-foreground">
                  Only send to conversations with these tags
                </p>
              </div>

              <div className="space-y-2">
                <Label>Exclude Conversations with Tags (Optional)</Label>
                <TagSelector
                  selectedTagIds={formData.exclude_tag_ids}
                  onTagChange={(tagIds) => setFormData({ ...formData, exclude_tag_ids: tagIds })}
                />
                <p className="text-xs text-muted-foreground">
                  Don&apos;t send to conversations with these tags
                </p>
              </div>

              {/* Tag Preview - Show Matching Conversations */}
              {(formData.include_tag_ids.length > 0 || formData.exclude_tag_ids.length > 0) && (
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                          📊 Tag Filter Preview
                        </h4>
                        <Badge variant="outline" className="bg-white">
                          Live Preview
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {formData.include_tag_ids.length > 0 && (
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Must Have Tags:</p>
                            <p className="font-medium text-green-600">
                              {formData.include_tag_ids.length} tag(s) required
                            </p>
                          </div>
                        )}

                        {formData.exclude_tag_ids.length > 0 && (
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Must NOT Have Tags:</p>
                            <p className="font-medium text-red-600">
                              {formData.exclude_tag_ids.length} tag(s) excluded
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">
                          💡 Automation will only run on conversations that:
                        </p>
                        <ul className="text-xs space-y-1 ml-4">
                          {formData.include_tag_ids.length > 0 && (
                            <li className="text-green-600">✅ Have ALL of the {formData.include_tag_ids.length} required tag(s)</li>
                          )}
                          {formData.exclude_tag_ids.length > 0 && (
                            <li className="text-red-600">❌ Do NOT have ANY of the {formData.exclude_tag_ids.length} excluded tag(s)</li>
                          )}
                          {!formData.run_24_7 && (
                            <li className="text-blue-600">
                              ⏰ Are contacted between {String(formData.active_hours_start).padStart(2, '0')}:{String(formData.active_hours_start_minutes).padStart(2, '0')} - {String(formData.active_hours_end).padStart(2, '0')}:{String(formData.active_hours_end_minutes).padStart(2, '0')}
                            </li>
                          )}
                          {formData.run_24_7 && (
                            <li className="text-purple-600">🌍 Can be contacted 24/7</li>
                          )}
                          <li className="text-gray-600">📊 Haven&apos;t exceeded daily limit ({formData.max_messages_per_day} max/day)</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxPerDay">Max Messages Per Day</Label>
                  <Input
                    id="maxPerDay"
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.max_messages_per_day}
                    onChange={(e) => setFormData({ ...formData, max_messages_per_day: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="messageTag">Message Tag</Label>
                  <Select
                    value={formData.message_tag}
                    onValueChange={(value) => setFormData({ ...formData, message_tag: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCOUNT_UPDATE">Account Update</SelectItem>
                      <SelectItem value="CONFIRMED_EVENT_UPDATE">Event Update</SelectItem>
                      <SelectItem value="POST_PURCHASE_UPDATE">Post-Purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 24/7 Mode Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <div>
                  <Label className="text-base font-semibold">Run 24/7 (All Day, Every Day)</Label>
                  <p className="text-sm text-muted-foreground">
                    Send messages at any time without hour restrictions
                  </p>
                </div>
                <Switch
                  checked={formData.run_24_7}
                  onCheckedChange={(checked) => setFormData({ ...formData, run_24_7: checked })}
                />
              </div>

              {/* Active Hours (only show if not 24/7) */}
              {!formData.run_24_7 && (
                <>
                  <div className="space-y-2">
                    <Label>Active Hours (with Minutes Precision)</Label>
                    <p className="text-sm text-muted-foreground">
                      Only send messages during these hours (local timezone)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Start Time */}
                    <div className="space-y-3">
                      <Label htmlFor="startHour" className="font-semibold">Start Time</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="startHour" className="text-xs">Hour</Label>
                          <Input
                            id="startHour"
                            type="number"
                            min="0"
                            max="23"
                            value={formData.active_hours_start}
                            onChange={(e) => setFormData({ ...formData, active_hours_start: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="startMinutes" className="text-xs">Minutes</Label>
                          <Input
                            id="startMinutes"
                            type="number"
                            min="0"
                            max="59"
                            value={formData.active_hours_start_minutes}
                            onChange={(e) => setFormData({ ...formData, active_hours_start_minutes: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        e.g., 9:30 AM = Hour: 9, Minutes: 30
                      </p>
                    </div>

                    {/* End Time */}
                    <div className="space-y-3">
                      <Label htmlFor="endHour" className="font-semibold">End Time</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="endHour" className="text-xs">Hour</Label>
                          <Input
                            id="endHour"
                            type="number"
                            min="0"
                            max="23"
                            value={formData.active_hours_end}
                            onChange={(e) => setFormData({ ...formData, active_hours_end: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endMinutes" className="text-xs">Minutes</Label>
                          <Input
                            id="endMinutes"
                            type="number"
                            min="0"
                            max="59"
                            value={formData.active_hours_end_minutes}
                            onChange={(e) => setFormData({ ...formData, active_hours_end_minutes: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        e.g., 9:45 PM = Hour: 21, Minutes: 45
                      </p>
                    </div>
                  </div>

                  {/* Time Preview */}
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium">
                      ⏰ Active window: {String(formData.active_hours_start).padStart(2, '0')}:{String(formData.active_hours_start_minutes).padStart(2, '0')} - {String(formData.active_hours_end).padStart(2, '0')}:{String(formData.active_hours_end_minutes).padStart(2, '0')}
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Enable Rule</Label>
                  <p className="text-sm text-muted-foreground">
                    Start automation immediately after creation
                  </p>
                </div>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Automation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog - Same as Create but for editing existing rules */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingRule(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Automation Rule</DialogTitle>
              <DialogDescription>
                Update your AI automation settings
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Daily Follow-ups"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What does this automation do?"
                  />
                </div>
              </div>

              {/* Time Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold">⏱️ Time Settings</h3>
                
                <div>
                  <label className="text-sm font-medium">Check Interval (minutes)</label>
                  <Input
                    type="number"
                    value={formData.time_interval_minutes || ''}
                    onChange={(e) => setFormData({ ...formData, time_interval_minutes: parseInt(e.target.value) || null })}
                    placeholder="60"
                    min="1"
                  />
                </div>

                {/* 24/7 Toggle */}
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-900">Run 24/7</p>
                          <p className="text-sm text-blue-600">Send messages all day, every day</p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.run_24_7}
                        onCheckedChange={(checked) => setFormData({ ...formData, run_24_7: checked })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {!formData.run_24_7 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Start Hour (0-23)</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={formData.active_hours_start}
                          onChange={(e) => setFormData({ ...formData, active_hours_start: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                          min="0"
                          max="23"
                          className="w-20"
                        />
                        <span className="self-center">:</span>
                        <Input
                          type="number"
                          value={formData.active_hours_start_minutes}
                          onChange={(e) => setFormData({ ...formData, active_hours_start_minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                          min="0"
                          max="59"
                          placeholder="00"
                          className="w-20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">End Hour (0-23)</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={formData.active_hours_end}
                          onChange={(e) => setFormData({ ...formData, active_hours_end: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                          min="0"
                          max="23"
                          className="w-20"
                        />
                        <span className="self-center">:</span>
                        <Input
                          type="number"
                          value={formData.active_hours_end_minutes}
                          onChange={(e) => setFormData({ ...formData, active_hours_end_minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                          min="0"
                          max="59"
                          placeholder="00"
                          className="w-20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!formData.run_24_7 && (
                  <p className="text-sm text-muted-foreground">
                    ⏰ Active window: {String(formData.active_hours_start).padStart(2, '0')}:{String(formData.active_hours_start_minutes).padStart(2, '0')} - {String(formData.active_hours_end).padStart(2, '0')}:{String(formData.active_hours_end_minutes).padStart(2, '0')}
                  </p>
                )}

                <div>
                  <label className="text-sm font-medium">Max Messages Per Day</label>
                  <Input
                    type="number"
                    value={formData.max_messages_per_day}
                    onChange={(e) => setFormData({ ...formData, max_messages_per_day: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>

              {/* AI Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold">🤖 AI Settings</h3>
                
                <div>
                  <label className="text-sm font-medium">AI Prompt Template</label>
                  <textarea
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    value={formData.custom_prompt}
                    onChange={(e) => setFormData({ ...formData, custom_prompt: e.target.value })}
                    placeholder="Write a personalized follow-up message..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Max Follow-ups</label>
                  <Input
                    type="number"
                    value={formData.max_follow_ups || ''}
                    onChange={(e) => setFormData({ ...formData, max_follow_ups: e.target.value ? parseInt(e.target.value) : null })}
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              {/* Tag Filters */}
              <div className="space-y-4">
                <h3 className="font-semibold">🏷️ Tag Filters</h3>
                
                <div>
                  <label className="text-sm font-medium text-green-700">Include Tags (must have ALL)</label>
                  <TagSelector
                    selectedTagIds={formData.include_tag_ids}
                    onTagChange={(tagIds) => setFormData({ ...formData, include_tag_ids: tagIds })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-red-700">Exclude Tags (must NOT have ANY)</label>
                  <TagSelector
                    selectedTagIds={formData.exclude_tag_ids}
                    onTagChange={(tagIds) => setFormData({ ...formData, exclude_tag_ids: tagIds })}
                  />
                </div>

                {/* Tag Filter Preview */}
                {(formData.include_tag_ids.length > 0 || formData.exclude_tag_ids.length > 0) && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-sm">📊 Tag Filter Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {formData.include_tag_ids.length > 0 && (
                        <p className="text-green-700">✅ Must have ALL of the {formData.include_tag_ids.length} required tag(s)</p>
                      )}
                      {formData.exclude_tag_ids.length > 0 && (
                        <p className="text-red-700">❌ Must NOT have ANY of the {formData.exclude_tag_ids.length} excluded tag(s)</p>
                      )}
                      <p className="text-muted-foreground pt-2">
                        Conversations matching these criteria will receive automated messages
                        {!formData.run_24_7 && ` between ${String(formData.active_hours_start).padStart(2, '0')}:${String(formData.active_hours_start_minutes).padStart(2, '0')} - ${String(formData.active_hours_end).padStart(2, '0')}:${String(formData.active_hours_end_minutes).padStart(2, '0')}`}
                        {formData.run_24_7 && ' 24/7'}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update Automation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Rules</p>
                <p className="text-3xl font-bold mt-2">{rules.length}</p>
              </div>
              <Bot className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-3xl font-bold mt-2">
                  {rules.filter(r => r.enabled).length}
                </p>
              </div>
              <Zap className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-3xl font-bold mt-2">
                  {rules.reduce((sum, r) => sum + (r.success_count || 0), 0) || 0}
                </p>
              </div>
              <Clock className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Rules</CardTitle>
          <CardDescription>
            Manage your AI-powered automatic message sending rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading automation rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Automation Rules Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI automation to start sending automatic personalized messages
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="mr-2 w-4 h-4" />
                Create First Automation
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <Card key={rule.id} className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{rule.name}</h3>
                          {rule.enabled ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Disabled
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-purple-600 border-purple-300">
                            <Clock className="w-3 h-3 mr-1" />
                            {getIntervalDisplay(rule)}
                          </Badge>
                        </div>

                        {rule.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {rule.description}
                          </p>
                        )}

                        <div className="bg-gray-50 p-3 rounded-lg mb-3">
                          <p className="text-xs font-semibold text-gray-600 mb-1">AI Prompt:</p>
                          <p className="text-sm font-mono whitespace-pre-wrap">
                            {rule.custom_prompt.length > 150 
                              ? rule.custom_prompt.substring(0, 150) + '...' 
                              : rule.custom_prompt}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>📊 Executed: {rule.execution_count} times</span>
                          <span>•</span>
                          <span>✅ Sent: {rule.success_count} messages</span>
                          <span>•</span>
                          <span>🔄 Max: {rule.max_follow_ups || '∞'} follow-ups</span>
                          <span>•</span>
                          <span>🛑 Stop on reply: {rule.stop_on_reply ? 'Yes' : 'No'}</span>
                          <span>•</span>
                          <span>🏷️ Tag: {rule.message_tag}</span>
                          <span>•</span>
                          {rule.run_24_7 ? (
                            <span>🌍 24/7 Mode</span>
                          ) : (
                            <span>⏰ {String(rule.active_hours_start).padStart(2, '0')}:{String(rule.active_hours_start_minutes || 0).padStart(2, '0')}-{String(rule.active_hours_end).padStart(2, '0')}:{String(rule.active_hours_end_minutes || 0).padStart(2, '0')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerMutation.mutate(rule.id)}
                          disabled={triggerMutation.isPending}
                          title="Trigger Now (Test)"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => 
                            toggleMutation.mutate({ id: rule.id, enabled: checked })
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMonitoringRule({ id: rule.id, name: rule.name })}
                          title="Live monitoring - see real-time progress"
                        >
                          <Activity className="w-4 h-4 text-purple-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(rule)}
                          title="Edit automation"
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(rule.id)}
                          title="Delete automation"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            How AI Automations Work
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• AI checks conversations based on your time interval (e.g., 24 hours after last message)</li>
            <li>• Reads up to 10 recent messages from each conversation for context</li>
            <li>• Generates personalized message using your custom prompt</li>
            <li>• Automatically sends with &quot;ACCOUNT_UPDATE&quot; tag (Facebook approved)</li>
            <li>• Respects active hours and daily limits</li>
            <li>• Each person gets unique message based on their conversation</li>
          </ul>
        </CardContent>
      </Card>

      {/* Live Monitor Modal */}
      {monitoringRule && (
        <AutomationLiveMonitor
          ruleId={monitoringRule.id}
          ruleName={monitoringRule.name}
          onClose={() => setMonitoringRule(null)}
        />
      )}
    </div>
  );
}

