'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { type Crumb } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

type EventRecord = {
  draft_id?: string;
  status?: string;
  customer_email?: string;
  subject?: string;
  created_at?: string | Date;
  approved_by?: string;
  approved_at?: string | Date;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function formatTime(value?: string | Date) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function getStatusLabel(status?: string) {
  if (!status) return 'pending';
  return status;
}

export default function OperationsEventsPage() {
  const t = useTranslations('admin.operations');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/events/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 200 }),
        });
        const payload = await response.json();
        if (!response.ok || payload.code !== 0) {
          setEvents([]);
          return;
        }
        setEvents(payload.data?.events || []);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const status = getStatusLabel(event.status);
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        event.customer_email,
        event.subject,
        event.draft_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [events, query, statusFilter]);

  const crumbs: Crumb[] = [
    { title: t('crumbs.admin'), url: '/admin' },
    { title: t('crumbs.operations'), url: '/admin/operations/events', is_active: true },
  ];

  const table: Table = {
    columns: [
      {
        name: 'draft_id',
        title: t('events.table.draftId'),
        type: 'copy',
      },
      {
        name: 'status',
        title: t('events.table.status'),
        type: 'label',
        callback: (item) => {
          const status = getStatusLabel(item.status);
          return (
            <Badge variant={status === 'approved' ? 'default' : 'secondary'}>
              {status}
            </Badge>
          );
        },
      },
      {
        name: 'customer_email',
        title: t('events.table.customer'),
        type: 'copy',
      },
      {
        name: 'subject',
        title: t('events.table.subject'),
      },
      {
        name: 'created_at',
        title: t('events.table.createdAt'),
        callback: (item) => formatTime(item.created_at),
      },
      {
        name: 'approved_by',
        title: t('events.table.approvedBy'),
      },
      {
        name: 'approved_at',
        title: t('events.table.approvedAt'),
        callback: (item) => formatTime(item.approved_at),
      },
    ],
    data: filteredEvents,
    emptyMessage: isLoading ? 'Loading...' : t('events.empty'),
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('events.title')} description={t('events.description')} />
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder={t('events.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger size="sm" className="min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('events.statusAll')}</SelectItem>
              <SelectItem value="pending">{t('events.statusPending')}</SelectItem>
              <SelectItem value="approved">{t('events.statusApproved')}</SelectItem>
              <SelectItem value="rejected">{t('events.statusRejected')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TableCard table={table} />
      </Main>
    </>
  );
}
