'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Save,
  DollarSign,
  Percent,
  X,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

interface Contact {
  sender_id: string;
  sender_name: string;
  page_id: string;
}

export default function BulkCreateOpportunitiesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [formData, setFormData] = useState({
    stageId: '',
    titleTemplate: '{contact_name} - New Opportunity',
    description: '',
    value: '',
    currency: 'USD',
    probability: '50'
  });

  // Load contacts from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('opportunityContacts');
    if (stored) {
      try {
        const data = JSON.parse(stored) as { contacts: Contact[] };
        if (data.contacts && data.contacts.length > 0) {
          setContacts(data.contacts);
          toast({
            title: "Contacts Loaded",
            description: `Ready to create ${data.contacts.length} opportunities`
          });
          sessionStorage.removeItem('opportunityContacts');
        } else {
          router.push('/dashboard/conversations');
        }
      } catch (e) {
        console.error('Error loading contacts:', e);
        router.push('/dashboard/conversations');
      }
    } else {
      router.push('/dashboard/conversations');
    }
  }, [router, toast]);

  // Fetch pipeline stages
  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pipeline/stages');
      if (!response.ok) throw new Error('Failed to fetch stages');
      const data = await response.json();
      return data.stages || [];
    },
    enabled: !!user?.id
  });

  // Bulk create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const opportunities = contacts.map(contact => ({
        page_id: contact.page_id,
        contact_name: contact.sender_name,
        contact_id: contact.sender_id,
        stage_id: formData.stageId,
        title: formData.titleTemplate.replace('{contact_name}', contact.sender_name),
        description: formData.description || null,
        value: parseFloat(formData.value) || 0,
        currency: formData.currency,
        probability: parseInt(formData.probability) || 0
      }));

      // Create opportunities one by one (with error handling)
      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const opp of opportunities) {
        try {
          const response = await fetch('/api/pipeline/opportunities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(opp)
          });

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
            const error = await response.json();
            results.errors.push(`${opp.contact_name}: ${error.error || 'Failed'}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`${opp.contact_name}: Network error`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });

      if (results.failed === 0) {
        toast({
          title: "✅ Opportunities Created!",
          description: `Successfully created ${results.success} opportunities.`,
          duration: 3000
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Created ${results.success} opportunities. ${results.failed} failed.`,
          variant: "destructive",
          duration: 5000
        });
      }

      router.push('/dashboard/pipeline');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create opportunities. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.stageId) {
      toast({
        title: "Validation Error",
        description: "Please select a pipeline stage.",
        variant: "destructive"
      });
      return;
    }

    createMutation.mutate();
  };

  const removeContact = (senderId: string) => {
    setContacts(contacts.filter(c => c.sender_id !== senderId));
    if (contacts.length <= 1) {
      router.push('/dashboard/conversations');
    }
  };

  const previewTitle = (contactName: string) => {
    return formData.titleTemplate.replace('{contact_name}', contactName);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
          <h1 className="text-3xl font-bold">Create Opportunities ({contacts.length})</h1>
          <p className="text-muted-foreground mt-1">
            Bulk create opportunities from selected conversations
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selected Contacts */}
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-purple-900">
                  Selected Contacts ({contacts.length})
                </CardTitle>
                <CardDescription className="text-purple-700">
                  Opportunities will be created for these contacts
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/conversations')}
                className="border-purple-300"
              >
                Change Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {contacts.slice(0, 50).map((contact) => (
                <Badge key={contact.sender_id} variant="secondary" className="px-3 py-2">
                  {contact.sender_name}
                  <button
                    type="button"
                    onClick={() => removeContact(contact.sender_id)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {contacts.length > 50 && (
                <Badge variant="outline" className="px-3 py-2 border-2 border-dashed">
                  + {contacts.length - 50} more contacts
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Template */}
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Template</CardTitle>
            <CardDescription>
              Settings will be applied to all {contacts.length} opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pipeline Stage */}
            <div>
              <Label htmlFor="stage">Pipeline Stage *</Label>
              <Select 
                value={formData.stageId} 
                onValueChange={(value) => setFormData({ ...formData, stageId: value })}
              >
                <SelectTrigger id="stage" className="mt-2">
                  <SelectValue placeholder="Select initial stage for all..." />
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
            </div>

            {/* Title Template */}
            <div>
              <Label htmlFor="titleTemplate">Title Template</Label>
              <Input
                id="titleTemplate"
                value={formData.titleTemplate}
                onChange={(e) => setFormData({ ...formData, titleTemplate: e.target.value })}
                placeholder="{contact_name} - New Opportunity"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-gray-100 px-1 rounded">{'{contact_name}'}</code> to personalize each opportunity
              </p>
              {contacts.length > 0 && (
                <p className="text-xs text-purple-600 mt-1">
                  Example: "{previewTitle(contacts[0].sender_name)}"
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add notes or description for all opportunities..."
                className="mt-2 min-h-20"
              />
            </div>

            {/* Value & Currency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="value">Default Deal Value (Optional)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="1000.00"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank for $0 (can update individually later)
                </p>
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
                Default probability for all opportunities (0-100%)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {formData.stageId && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Creation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opportunities to create:</span>
                  <span className="font-semibold">{contacts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stage:</span>
                  <span className="font-semibold">
                    {stages.find(s => s.id === formData.stageId)?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value per opportunity:</span>
                  <span className="font-semibold">
                    ${parseFloat(formData.value || '0').toLocaleString()} {formData.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Probability:</span>
                  <span className="font-semibold">{formData.probability}%</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Total Pipeline Value:</span>
                  <span className="font-semibold text-green-600">
                    ${(parseFloat(formData.value || '0') * contacts.length).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weighted Value:</span>
                  <span className="font-semibold text-purple-600">
                    ${Math.round((parseFloat(formData.value || '0') * contacts.length * parseInt(formData.probability)) / 100).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Examples */}
        {contacts.length > 0 && formData.stageId && (
          <Card>
            <CardHeader>
              <CardTitle>Preview (First 3 Opportunities)</CardTitle>
              <CardDescription>
                How the opportunities will be created
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contacts.slice(0, 3).map((contact) => (
                  <div key={contact.sender_id} className="p-3 border rounded-lg bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{previewTitle(contact.sender_name)}</p>
                        <p className="text-sm text-muted-foreground">{contact.sender_name}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" style={{ borderColor: stages.find(s => s.id === formData.stageId)?.color }}>
                            {stages.find(s => s.id === formData.stageId)?.name}
                          </Badge>
                          {formData.value && (
                            <Badge className="bg-green-100 text-green-700">
                              ${parseFloat(formData.value).toLocaleString()}
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {formData.probability}% probability
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {contacts.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    + {contacts.length - 3} more opportunities will be created
                  </p>
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
            onClick={() => router.push('/dashboard/conversations')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#1877f2] hover:bg-[#166fe5]"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating {contacts.length} Opportunities...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create {contacts.length} Opportunities
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

