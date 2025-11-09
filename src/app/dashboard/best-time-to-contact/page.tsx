'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, TrendingUp, Search, RefreshCw, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { RecommendedWindow } from '@/types/database';

interface ContactRecommendation {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  timezone: string;
  timezone_confidence: 'low' | 'medium' | 'high';
  timezone_source: string | null;
  recommended_windows: RecommendedWindow[];
  max_confidence: number;
  recency_score: number;
  priority_score: number;
  composite_score: number;
  last_positive_signal_at: string | null;
  last_contact_attempt_at: string | null;
  total_attempts: number;
  total_successes: number;
  overall_response_rate: number;
  is_active: boolean;
  cooldown_until: string | null;
  notes: string | null;
  last_computed_at: string;
}

interface ApiResponse {
  success: boolean;
  data: ContactRecommendation[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export default function BestTimeToContactPage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<ContactRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('composite_score');
  const [minConfidence, setMinConfidence] = useState('0');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false,
  });

  useEffect(() => {
    fetchRecommendations();
  }, [sortBy, minConfidence, pagination.offset]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        sort_by: sortBy,
        sort_order: 'desc',
        min_confidence: minConfidence,
        active_only: 'true',
        search: searchTerm,
      });

      const response = await fetch(`/api/contact-timing/recommendations?${params}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setRecommendations(data.data);
        setPagination(data.pagination);
      } else {
        toast.error('Failed to load recommendations');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleComputeAll = async () => {
    try {
      setComputing(true);
      toast.info('Computing best contact times...');

      const response = await fetch('/api/contact-timing/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recompute_all: true }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Computed times for ${data.processed} contacts in ${(data.duration_ms / 1000).toFixed(1)}s`);
        fetchRecommendations();
      } else {
        toast.error('Failed to compute contact times');
      }
    } catch (error) {
      console.error('Error computing times:', error);
      toast.error('Failed to compute contact times');
    } finally {
      setComputing(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    fetchRecommendations();
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) {
      return <Badge className="bg-green-500">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
    if (confidence >= 0.4) {
      return <Badge className="bg-yellow-500">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
    return <Badge className="bg-gray-500">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
  };

  const getTimezoneConfidenceBadge = (confidence: 'low' | 'medium' | 'high') => {
    const colors = {
      high: 'bg-green-500',
      medium: 'bg-yellow-500',
      low: 'bg-gray-500',
    };
    return <Badge className={colors[confidence]}>{confidence}</Badge>;
  };

  const formatWindow = (window: RecommendedWindow) => {
    return `${window.dow} ${window.start}-${window.end}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Best Time to Contact</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered recommendations for optimal contact timing based on engagement patterns
          </p>
        </div>
        <Button onClick={handleComputeAll} disabled={computing} size="lg">
          {computing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Computing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Compute All
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recommendations.filter((r) => r.max_confidence >= 0.7).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recommendations.length > 0
                ? Math.round(
                    recommendations.reduce((acc, r) => acc + r.overall_response_rate, 0) /
                      recommendations.length
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recommendations.filter((r) => r.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine your contact recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="composite_score">Composite Score</SelectItem>
                <SelectItem value="max_confidence">Confidence</SelectItem>
                <SelectItem value="recency_score">Recency</SelectItem>
                <SelectItem value="last_contact_attempt_at">Last Contact</SelectItem>
                <SelectItem value="sender_name">Name</SelectItem>
              </SelectContent>
            </Select>

            <Select value={minConfidence} onValueChange={setMinConfidence}>
              <SelectTrigger>
                <SelectValue placeholder="Min Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All</SelectItem>
                <SelectItem value="0.3">30%+</SelectItem>
                <SelectItem value="0.5">50%+</SelectItem>
                <SelectItem value="0.7">70%+</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setSortBy('composite_score');
              setMinConfidence('0');
              fetchRecommendations();
            }}>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Recommendations</CardTitle>
          <CardDescription>
            Showing {recommendations.length} of {pagination.total} contacts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Recommendations Yet</h3>
              <p className="text-muted-foreground mb-4">
                Click &quot;Compute All&quot; to generate best contact time recommendations
              </p>
              <Button onClick={handleComputeAll} disabled={computing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Compute Now
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Timezone</TableHead>
                      <TableHead>Best Times (Top 3)</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Response Rate</TableHead>
                      <TableHead>Last Signal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recommendations.map((rec) => (
                      <TableRow key={rec.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{rec.sender_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {rec.total_attempts} attempts • {rec.total_successes} successes
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm">{rec.timezone}</div>
                              {getTimezoneConfidenceBadge(rec.timezone_confidence)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {rec.recommended_windows.slice(0, 3).map((window, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">{formatWindow(window)}</span>
                                <Badge variant="outline" className="text-xs">
                                  {(window.confidence * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            ))}
                            {rec.recommended_windows.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{rec.recommended_windows.length - 3} more
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(rec.max_confidence)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="font-semibold">
                              {(rec.composite_score * 100).toFixed(0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rec.overall_response_rate >= 50 ? 'default' : 'secondary'}>
                            {rec.overall_response_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(rec.last_positive_signal_at)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1} to{' '}
                  {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                  {pagination.total} contacts
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        offset: Math.max(0, prev.offset - prev.limit),
                      }))
                    }
                    disabled={pagination.offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        offset: prev.offset + prev.limit,
                      }))
                    }
                    disabled={!pagination.has_more}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

