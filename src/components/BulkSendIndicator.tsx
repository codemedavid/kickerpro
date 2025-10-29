'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface SendingMessage {
  id: string;
  title: string;
  recipient_count: number | null;
  delivered_count: number | null;
  status: string;
}

export function BulkSendIndicator() {
  const [current, setCurrent] = useState<SendingMessage | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch('/api/messages?status=sending', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const messages: SendingMessage[] = data.messages || [];
        setCurrent(messages.length > 0 ? messages[0] : null);
      } catch {
        // ignore
      }
    };

    poll();
    timer = setInterval(poll, 1500);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!current) return null;

  const progressTotal = current.recipient_count ?? 0;
  const progressSent = current.delivered_count ?? 0;
  const percent = progressTotal > 0 ? Math.min(100, Math.round((progressSent / progressTotal) * 100)) : 0;

  const handleCancel = async () => {
    try {
      setCancelling(true);
      await fetch(`/api/messages/${current.id}/cancel`, { method: 'POST' });
    } finally {
      setCancelling(false);
      setExpanded(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        <button
          type="button"
          aria-label="Bulk sending in progress"
          onClick={() => setExpanded((v) => !v)}
          className="h-12 w-12 rounded-full bg-[#1877f2] text-white shadow-lg flex items-center justify-center hover:bg-[#166fe5] focus:outline-none"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
        </button>

        {expanded && (
          <div className="absolute bottom-14 right-0 w-72 rounded-lg border bg-white shadow-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Sending: {current.title || 'Message'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {progressSent} / {progressTotal} • {percent}%
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-[#1877f2]" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


