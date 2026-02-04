'use client';

import { useEffect, useMemo, useState } from 'react';
import moment from 'moment';

import { DecisionAction } from './decision-action';
import { MemoryBrain } from './memory-brain';
import { PerceptionHub } from './perception-hub';
import { EmailItem, KnowledgeHit, PersonaTag } from './types';

function getDisplayName(email: string) {
  const name = email.split('@')[0] || 'Customer';
  return name.replace(/[._-]+/g, ' ').trim();
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AgentConsole() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [tags, setTags] = useState<PersonaTag[]>([]);
  const [hits, setHits] = useState<KnowledgeHit[]>([]);
  const [cotSteps, setCotSteps] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [isLoadingBrain, setIsLoadingBrain] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedEmail = useMemo(
    () =>
      selectedEmailId
        ? emails.find((e) => e.id === selectedEmailId) || null
        : null,
    [emails, selectedEmailId]
  );

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoadingEmails(true);
      try {
        const response = await fetch('/api/events/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 50 }),
        });
        const payload = await response.json();
        if (!response.ok || payload.code !== 0) {
          setEmails([]);
          setSelectedEmailId(null);
          return;
        }

        const items: EmailItem[] = (payload.data?.events || []).map(
          (event: any) => {
            const customerEmail = event.customer_email || '';
            const name = getDisplayName(customerEmail);
            const initials = getInitials(name);
            const createdAt = event.created_at
              ? new Date(event.created_at)
              : null;
            return {
              id: event.draft_id || event.email_id || event.correlation_id,
              avatar: initials || 'C',
              name: name || 'Customer',
              email: customerEmail,
              intent: 'Support',
              snippet: (event.original_body || '').slice(0, 140),
              time: createdAt ? moment(createdAt).fromNow() : '',
              subject: event.subject || '',
              body: event.original_body || '',
              isVip: false,
              status: event.status || 'pending',
              draftId: event.draft_id || '',
              emailId: event.email_id || '',
              draftContent: event.draft_content || '',
              reasoning: event.reasoning || '',
              approvedBy: event.approved_by || '',
              approvedAt: event.approved_at || '',
            };
          }
        );

        setEmails(items);
        if (
          !selectedEmailId ||
          !items.some((item) => item.id === selectedEmailId)
        ) {
          const nextSelected =
            items.find((item) => item.status !== 'approved') ||
            items[0] ||
            null;
          setSelectedEmailId(nextSelected?.id ?? null);
        }
      } finally {
        setIsLoadingEmails(false);
      }
    };

    fetchEvents();
  }, [refreshKey, selectedEmailId]);

  useEffect(() => {
    if (!selectedEmail) {
      setTags([]);
      setHits([]);
      setCotSteps([]);
      setDraft('');
      return;
    }

    setDraft(selectedEmail.draftContent || '');
    const reasoningSteps = (selectedEmail.reasoning || '')
      .split('|')
      .map((step) => step.trim())
      .filter(Boolean);
    setCotSteps(reasoningSteps);

    const fetchBrain = async () => {
      setIsLoadingBrain(true);
      try {
        const [personaRes, knowledgeRes] = await Promise.all([
          selectedEmail.email
            ? fetch('/api/persona/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer_email: selectedEmail.email }),
              })
            : Promise.resolve(null),
          fetch('/api/knowledge/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query_text:
                `${selectedEmail.subject}\n${selectedEmail.body}`.trim(),
              top_k: 3,
            }),
          }),
        ]);

        if (personaRes) {
          const personaPayload = await personaRes.json();
          setTags(personaPayload.data?.tags || []);
        } else {
          setTags([]);
        }

        const knowledgePayload = knowledgeRes
          ? await knowledgeRes.json()
          : null;
        const mappedHits: KnowledgeHit[] = (
          knowledgePayload?.data?.hits || []
        ).map((hit: any) => ({
          id: hit.chunk_id || hit.id || hit._id || '',
          file: hit.source || hit.metadata?.source || '',
          segment: hit.chunk_text || '',
          score: hit.score || 0,
        }));
        setHits(mappedHits);
      } finally {
        setIsLoadingBrain(false);
      }
    };

    fetchBrain();
  }, [selectedEmail]);

  return (
    <div className="bg-card flex h-[calc(100vh-4rem)] w-full overflow-hidden rounded-lg border shadow-sm">
      <div className="w-1/4 max-w-[350px] min-w-[280px]">
        <PerceptionHub
          emails={emails}
          selectedId={selectedEmailId}
          onSelect={setSelectedEmailId}
        />
      </div>

      <div className="w-[30%] min-w-[300px] border-l">
        <MemoryBrain
          tags={tags}
          hits={hits}
          isLoading={isLoadingEmails || isLoadingBrain}
        />
      </div>

      <div className="min-w-[400px] flex-1 border-l">
        <DecisionAction
          email={selectedEmail}
          cotSteps={cotSteps}
          initialDraft={draft}
          onApproved={() => setRefreshKey((value) => value + 1)}
          isLoading={isLoadingEmails}
        />
      </div>
    </div>
  );
}
