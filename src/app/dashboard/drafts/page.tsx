'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Trash2, 
  Eye,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DraftMessage {
  id: string;
  title: string;
  content: string;
  page_id: string;
  recipient_type: 'all' | 'active' | 'selected';
  recipient_count: number;
  message_tag: string | null;
  selected_recipients: string[] | null;
  created_at: string;
}

interface FacebookPage {
  id: string;
  name: string;
}

export default function DraftsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  // Fetch pages
  const { data: pages = [] } = useQuery<FacebookPage[]>({
    queryKey: ['pages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error('Failed to fetch pages');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch draft messages
  const { data: drafts = [], isLoading } = useQuery<DraftMessage[]>({
    queryKey: ['draft-messages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/messages?status=draft');
      if (!response.ok) throw new Error('Failed to fetch drafts');
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!user?.id
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete draft');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-messages'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({
        title: "Draft Deleted",
        description: "Draft message has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setDraftToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete draft. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getPageName = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    return page?.name || 'Unknown Page';
  };

  const handleDelete = (draftId: string) => {
    setDraftToDelete(draftId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (draftToDelete) {
      deleteMutation.mutate(draftToDelete);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Draft Messages</h1>
          <p className="text-muted-foreground mt-1">
            Messages saved for later editing and sending
          </p>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/compose')}
          className="bg-[#1877f2] hover:bg-[#166fe5]"
        >
          <FileText className="w-4 h-4 mr-2" />
          Create New Draft
        </Button>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Drafts</p>
              <p className="text-3xl font-bold mt-2">{drafts.length}</p>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drafts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Drafts ({drafts.length})</CardTitle>
          <CardDescription>
            Continue editing or send your draft messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Drafts Yet</h3>
              <p className="text-muted-foreground mb-6">
                You haven&apos;t saved any draft messages. Create one to get started.
              </p>
              <Button 
                onClick={() => router.push('/dashboard/compose')}
                className="bg-[#1877f2] hover:bg-[#166fe5]"
              >
                <FileText className="w-4 h-4 mr-2" />
                Create Draft
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{draft.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {draft.content.substring(0, 200)}
                        {draft.content.length > 200 && '...'}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {getPageName(draft.page_id)}
                        </span>
                        <Badge variant="secondary">
                          {draft.recipient_type === 'selected' 
                            ? `${draft.recipient_count} selected`
                            : draft.recipient_type === 'all'
                            ? `${draft.recipient_count} followers`
                            : `~${draft.recipient_count} active`}
                        </Badge>
                        {draft.message_tag && (
                          <Badge variant="default" className="bg-purple-600">
                            {draft.message_tag.replace('_', ' ')}
                          </Badge>
                        )}
                        {draft.selected_recipients && draft.selected_recipients.length > 100 && (
                          <Badge variant="outline">
                            {Math.ceil(draft.selected_recipients.length / 100)} batches
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Created {format(parseISO(draft.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/messages/${draft.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(draft.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The draft message will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

