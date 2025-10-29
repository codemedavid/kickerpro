'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Save,
  DollarSign,
  Calendar,
  Percent
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface PipelineStage {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface FacebookPage {
  id: string;
  name: string;
  facebook_page_id: string;
}

interface Conversation {
  id: string;
  sender_id: string;
  sender_name: string | null;
  page_id: string;
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    conversationId: '',
    pageId: '',
    contactName: '',
    contactId: '',
    stageId: '',
    title: '',
    description: '',
    value: '',
    currency: 'USD',
    probability: '50',
    expectedCloseDate: ''
  });

  // Load from sessionStorage if coming from conversation
  useEffect(() => {
    const stored = sessionStorage.getItem('opportunityContact');
    if (!stored) return;

    try {
      const data = JSON.parse(stored) as {
        sender_id: string;
        sender_name: string;
        page_id: string;
        pageUuid?: string;
      };
      
      // Set initial form data from stored contact
      setFormData({
        conversationId: '',
        pageId: data.pageUuid || '',
        contactName: data.sender_name,
        contactId: data.sender_id,
        stageId: '',
        title: `${data.sender_name} - New Opportunity`,
        description: '',
        value: '',
        currency: 'USD',
        probability: '50',
        expectedCloseDate: ''
      });
      
      toast({
        title: "Contact Loaded",
        description: `Creating opportunity for ${data.sender_name}`
      });
      
      sessionStorage.removeItem('opportunityContact');
    } catch (e) {
      console.error('Error loading contact:', e);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Fetch Facebook pages
  const { data: pages = [], isLoading: pagesLoading } = useQuery<FacebookPage[]>({
    queryKey: ['pages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
    enabled: !!user?.id
  });

  const selectedPage = useMemo(
    () => pages.find(p => p.id === formData.pageId) || null,
    [pages, formData.pageId]
  );

  // Fetch conversations for selected page
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['conversations-for-opportunity', selectedPage?.facebook_page_id],
    queryFn: async () => {
      if (!selectedPage?.facebook_page_id) return [];
      const response = await fetch(`/api/conversations?facebookPageId=${selectedPage.facebook_page_id}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      return data.conversations || [];
    },
    enabled: !!selectedPage?.facebook_page_id
  });

  // Create opportunity mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/pipeline/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: data.conversationId || null,
          page_id: data.pageId,
          contact_name: data.contactName,
          contact_id: data.contactId,
          stage_id: data.stageId,
          title: data.title,
          description: data.description || null,
          value: parseFloat(data.value) || 0,
          currency: data.currency,
          probability: parseInt(data.probability) || 0,
          expected_close_date: data.expectedCloseDate || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create opportunity');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      toast({
        title: "Opportunity Created!",
        description: "New opportunity added to your pipeline successfully.",
        duration: 3000
      });

      router.push('/dashboard/pipeline');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create opportunity. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.pageId || !formData.contactName || !formData.contactId || 
        !formData.stageId || !formData.title) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    createMutation.mutate(formData);
  };

  // Auto-fill contact details when conversation is selected
  const handleConversationSelect = (conversationId: string) => {
    if (conversationId === 'manual') {
      // Clear contact fields for manual entry
      setFormData(prev => ({
        ...prev,
        conversationId: '',
        contactName: '',
        contactId: ''
      }));
      return;
    }

    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setFormData(prev => ({
        ...prev,
        conversationId,
        contactName: conversation.sender_name || `User ${conversation.sender_id.substring(0, 8)}`,
        contactId: conversation.sender_id
      }));
    }
  };

  // Get selected page details
  const selectedPage = pages.find(p => p.id === formData.pageId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Opportunity</h1>
          <p className="text-muted-foreground mt-1">
            Add a new sales opportunity to your pipeline
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>
              Who is this opportunity for?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Select Page */}
            <div>
              <Label htmlFor="page">Facebook Page *</Label>
              <Select 
                value={formData.pageId} 
                onValueChange={(value) => setFormData({ ...formData, pageId: value, conversationId: '', contactName: '', contactId: '' })}
                disabled={pagesLoading}
              >
                <SelectTrigger id="page" className="mt-2">
                  <SelectValue placeholder="Select a page..." />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select from Conversation (Optional) */}
            {formData.pageId && conversations.length > 0 && (
              <div>
                <Label htmlFor="conversation">
                  From Conversation (Optional)
                </Label>
                <Select 
                  value={formData.conversationId} 
                  onValueChange={handleConversationSelect}
                >
                  <SelectTrigger id="conversation" className="mt-2">
                    <SelectValue placeholder="Select existing conversation or enter manually..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Enter manually</SelectItem>
                    {conversations.slice(0, 50).map((conv) => (
                      <SelectItem key={conv.id} value={conv.id}>
                        {conv.sender_name || `User ${conv.sender_id.substring(0, 10)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-fills contact details from conversation
                </p>
              </div>
            )}

            {/* Contact Name */}
            <div>
              <Label htmlFor="contactName">Contact Name *</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="John Doe"
                className="mt-2"
                required
              />
            </div>

            {/* Contact ID (Facebook PSID) */}
            <div>
              <Label htmlFor="contactId">Facebook Contact ID (PSID) *</Label>
              <Input
                id="contactId"
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                placeholder="1234567890123456"
                className="mt-2"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                The Facebook PSID from messenger conversations
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Details */}
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Details</CardTitle>
            <CardDescription>
              Information about this sales opportunity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <Label htmlFor="title">Opportunity Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Website Redesign Project"
                className="mt-2"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Client needs a new website with e-commerce functionality..."
                className="mt-2 min-h-24"
              />
            </div>

            {/* Pipeline Stage */}
            <div>
              <Label htmlFor="stage">Pipeline Stage *</Label>
              <Select 
                value={formData.stageId} 
                onValueChange={(value) => setFormData({ ...formData, stageId: value })}
                disabled={stagesLoading}
              >
                <SelectTrigger id="stage" className="mt-2">
                  <SelectValue placeholder="Select a stage..." />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
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
              {stagesLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  Loading stages...
                </p>
              )}
            </div>

            {/* Value */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="value">Deal Value</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="5000.00"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
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

            {/* Probability */}
            <div>
              <Label htmlFor="probability">Win Probability (%)</Label>
              <div className="relative mt-2">
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                  className="pr-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Estimated likelihood of winning this deal (0-100%)
              </p>
            </div>

            {/* Expected Close Date */}
            <div>
              <Label htmlFor="closeDate">Expected Close Date</Label>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="closeDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                When do you expect to close this deal?
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Summary Preview */}
        {formData.title && formData.stageId && (
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-purple-900">Opportunity Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title:</span>
                  <span className="font-semibold">{formData.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="font-semibold">{formData.contactName || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stage:</span>
                  <span className="font-semibold">
                    {stages.find(s => s.id === formData.stageId)?.name || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Page:</span>
                  <span className="font-semibold">
                    {selectedPage?.name || 'Not selected'}
                  </span>
                </div>
                {formData.value && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value:</span>
                    <span className="font-semibold text-green-600">
                      ${parseFloat(formData.value).toLocaleString()} {formData.currency}
                    </span>
                  </div>
                )}
                {formData.probability && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Probability:</span>
                    <span className="font-semibold">{formData.probability}%</span>
                  </div>
                )}
                {formData.probability && formData.value && (
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Weighted Value:</span>
                    <span className="font-semibold text-purple-600">
                      ${Math.round((parseFloat(formData.value) * parseInt(formData.probability)) / 100).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#1877f2] hover:bg-[#166fe5]"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>Creating...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Opportunity
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
