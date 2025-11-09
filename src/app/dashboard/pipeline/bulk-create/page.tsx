'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  Save, 
  ArrowLeft,
  DollarSign,
  Percent,
  Calendar as CalendarIcon,
  Users,
  Sparkles,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface PipelineStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
  color: string;
  is_active: boolean;
}

interface Contact {
  sender_id: string;
  sender_name: string;
  page_id: string;
}

interface BulkOpportunity {
  title: string;
  description?: string;
  contact_name: string;
  contact_id: string;
  page_id?: string;
  stage_id: string;
  value: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  status: 'open' | 'won' | 'lost';
}

export default function BulkCreateOpportunitiesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [bulkFormData, setBulkFormData] = useState({
    stageId: '',
    titleTemplate: '{name} - New Opportunity',
    value: '',
    currency: 'USD',
    probability: '50',
    expectedCloseDate: ''
  });
  const [useAIClassification, setUseAIClassification] = useState(false);
  const [classificationResults, setClassificationResults] = useState<any[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);

  // Load contacts from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('opportunityContacts');
    if (!stored) {
      toast({
        title: "No Contacts Found",
        description: "Please select contacts from the conversations page.",
        variant: "destructive"
      });
      router.push('/dashboard/conversations');
      return;
    }

    try {
      const data = JSON.parse(stored) as { contacts: Contact[]; pageId?: string };
      if (!data.contacts || data.contacts.length === 0) {
        toast({
          title: "No Contacts Found",
          description: "Please select contacts from the conversations page.",
          variant: "destructive"
        });
        router.push('/dashboard/conversations');
        return;
      }

      setContacts(data.contacts);
      toast({
        title: "Contacts Loaded",
        description: `Creating opportunities for ${data.contacts.length} contact(s)`
      });
      sessionStorage.removeItem('opportunityContacts');
    } catch (e) {
      console.error('Error loading contacts:', e);
      toast({
        title: "Error",
        description: "Failed to load contacts. Please try again.",
        variant: "destructive"
      });
      router.push('/dashboard/conversations');
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch pipeline stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/stages');
      if (!response.ok) throw new Error('Failed to fetch pipeline stages');
      const data = await response.json();
      return data.stages || [];
    },
    enabled: !!user?.id
  });

  // Set default stage when stages first load
  const [hasSetDefaultStage, setHasSetDefaultStage] = useState(false);
  useEffect(() => {
    if (stages.length > 0 && !bulkFormData.stageId && !hasSetDefaultStage) {
      const firstStage = stages.sort((a, b) => a.stage_order - b.stage_order)[0];
      if (firstStage) {
        setBulkFormData(prev => ({ ...prev, stageId: firstStage.id }));
        setHasSetDefaultStage(true);
      }
    }
  }, [stages, bulkFormData.stageId, hasSetDefaultStage]);

  // Bulk create mutation
  const createMutation = useMutation({
    mutationFn: async (opportunities: BulkOpportunity[]) => {
      const response = await fetch('/api/pipeline/opportunities/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunities }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create opportunities');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      
      toast({
        title: "Success!",
        description: `Created ${data.created} opportunit${data.created === 1 ? 'y' : 'ies'} successfully!`,
        duration: 5000
      });

      router.push('/dashboard/pipeline');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create opportunities. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAIClassification = async () => {
    setIsClassifying(true);
    
    try {
      // Get conversation IDs from contacts
      const contactsWithIds = sessionStorage.getItem('opportunityContactsFull');
      if (!contactsWithIds) {
        throw new Error('Contact data not found');
      }

      const fullContacts = JSON.parse(contactsWithIds);
      const conversationIds = fullContacts.map((c: any) => c.id);

      const response = await fetch('/api/ai/classify-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationIds,
          pageId: contacts[0]?.page_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to classify stages');
      }

      const data = await response.json();
      setClassificationResults(data.classifications);
      setUseAIClassification(true);
      
      toast({
        title: "AI Classification Complete!",
        description: `Analyzed ${data.analyzed} conversations and assigned pipeline stages.`,
        duration: 4000
      });

    } catch (error) {
      toast({
        title: "Classification Error",
        description: error instanceof Error ? error.message : 'Failed to classify',
        variant: "destructive"
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!useAIClassification && !bulkFormData.stageId) {
      toast({
        title: "Validation Error",
        description: "Please select a pipeline stage or use AI classification.",
        variant: "destructive"
      });
      return;
    }

    if (!bulkFormData.value || parseFloat(bulkFormData.value) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid opportunity value.",
        variant: "destructive"
      });
      return;
    }

    // Create opportunities from contacts
    const opportunities = contacts.map((contact, index) => {
      // Find AI classification for this contact if available
      const aiClassification = classificationResults.find(
        r => r.contactName === contact.sender_name
      );

      return {
        title: bulkFormData.titleTemplate.replace('{name}', contact.sender_name),
        description: aiClassification 
          ? `${aiClassification.reasoning}` 
          : `Opportunity created from conversation with ${contact.sender_name}`,
        contact_name: contact.sender_name,
        contact_id: contact.sender_id,
        page_id: contact.page_id,
        stage_id: useAIClassification && aiClassification 
          ? aiClassification.recommendedStageId 
          : bulkFormData.stageId,
        value: parseFloat(bulkFormData.value),
        currency: bulkFormData.currency,
        probability: useAIClassification && aiClassification
          ? aiClassification.probability
          : parseInt(bulkFormData.probability),
        expected_close_date: bulkFormData.expectedCloseDate || null,
        status: 'open' as const
      };
    });

    createMutation.mutate(opportunities);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bulk Create Opportunities</h1>
          <p className="text-muted-foreground mt-1">
            Creating {contacts.length} opportunit{contacts.length === 1 ? 'y' : 'ies'} from selected contacts
          </p>
        </div>
      </div>

      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-purple-900">
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''} selected
              </p>
              <p className="text-sm text-purple-700">
                All opportunities will be created with the same settings below
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* AI Classification Section */}
        <Card className="border-2 border-dashed border-purple-300 bg-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  AI-Powered Stage Classification
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Let AI analyze each conversation and assign the best pipeline stage automatically
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAIClassification}
                disabled={isClassifying || useAIClassification}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isClassifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : useAIClassification ? (
                  <>
                    <Check className="w-4 h-4" />
                    Classified
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Classify with AI
                  </>
                )}
              </Button>
            </div>

            {useAIClassification && classificationResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">AI Recommendations:</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {classificationResults.slice(0, 10).map((result, i) => (
                    <div key={i} className="text-xs bg-white p-2 rounded border">
                      <span className="font-medium">{result.contactName}</span>
                      {' → '}
                      <span className="text-purple-600">{result.recommendedStageName}</span>
                      {' '}
                      <span className="text-gray-500">({result.probability}%)</span>
                    </div>
                  ))}
                  {classificationResults.length > 10 && (
                    <p className="text-xs text-gray-500 italic">
                      ...and {classificationResults.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stage Selection */}
        {!useAIClassification && (
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stage</CardTitle>
              <CardDescription>Select the initial stage for all opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="stage">Stage *</Label>
            {stagesLoading ? (
              <Skeleton className="h-10 mt-2" />
            ) : (
              <Select
                value={bulkFormData.stageId}
                onValueChange={(value) => setBulkFormData({ ...bulkFormData, stageId: value })}
              >
                <SelectTrigger id="stage" className="mt-2">
                  <SelectValue placeholder="Select a stage..." />
                </SelectTrigger>
                <SelectContent>
                  {stages
                    .sort((a, b) => a.stage_order - b.stage_order)
                    .map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            </CardContent>
          </Card>
        )}

        {/* Opportunity Details */}
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Details</CardTitle>
            <CardDescription>Settings that will apply to all opportunities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title-template">Title Template</Label>
              <Input
                id="title-template"
                value={bulkFormData.titleTemplate}
                onChange={(e) => setBulkFormData({ ...bulkFormData, titleTemplate: e.target.value })}
                placeholder="Use {name} for contact name..."
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{name}'} to include the contact&apos;s name
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Value *
                </Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bulkFormData.value}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, value: e.target.value })}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={bulkFormData.currency}
                  onValueChange={(value) => setBulkFormData({ ...bulkFormData, currency: value })}
                >
                  <SelectTrigger id="currency" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="PHP">PHP (₱)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="probability" className="flex items-center gap-2">
                  <Percent className="w-4 h-4" /> Win Probability
                </Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={bulkFormData.probability}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, probability: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="expected-close" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> Expected Close Date
                </Label>
                <Input
                  id="expected-close"
                  type="date"
                  value={bulkFormData.expectedCloseDate}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, expectedCloseDate: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Contacts Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Selected Contacts ({contacts.length})</CardTitle>
            <CardDescription>Opportunities will be created for these contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {contacts.map((contact, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-2">
                    {contact.sender_name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create {contacts.length} Opportunit{contacts.length === 1 ? 'y' : 'ies'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
