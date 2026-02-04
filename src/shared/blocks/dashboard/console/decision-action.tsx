import { useEffect, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  PenLine,
  RotateCcw,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Textarea } from '@/shared/components/ui/textarea';

import { EmailItem } from './types';

interface DecisionActionProps {
  email: EmailItem | null;
  cotSteps: string[];
  initialDraft: string;
  onApproved?: () => void;
  isLoading?: boolean;
}

export function DecisionAction({
  email,
  cotSteps,
  initialDraft,
  onApproved,
  isLoading,
}: DecisionActionProps) {
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Reset draft when email changes
  useEffect(() => {
    setDraft(initialDraft);
    setIsEditing(false);
  }, [email, initialDraft]);

  if (!email) {
    return (
      <div className="text-muted-foreground bg-muted/5 flex h-full items-center justify-center p-8 text-center">
        {isLoading
          ? 'Loading...'
          : 'Select an email to view details and generate reply.'}
      </div>
    );
  }

  const handleApprove = async () => {
    if (!email.draftId) {
      toast.error('Draft is missing.');
      return;
    }
    setIsApproving(true);
    try {
      const userRes = await fetch('/api/user/get-user-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const userPayload = await userRes.json();
      const approvedBy =
        userPayload?.data?.name || userPayload?.data?.email || 'admin';

      const response = await fetch('/api/draft/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: email.draftId,
          approved_by: approvedBy,
          draft_content: draft,
          email_id: email.emailId || '',
          customer_email: email.email || '',
          subject: email.subject || '',
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || 'Approve failed.');
      }
      toast.success('Approved and sent.');
      onApproved?.();
    } catch (error: any) {
      toast.error(error?.message || 'Approve failed.');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Zone A: Original Email */}
      <div className="border-b">
        <button
          onClick={() => setIsEmailExpanded(!isEmailExpanded)}
          className="hover:bg-muted/50 flex w-full items-center justify-between p-4 transition-colors"
        >
          <div className="truncate pr-4 text-sm font-semibold">
            Subject: {email.subject}
          </div>
          {isEmailExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {isEmailExpanded && (
          <div className="text-muted-foreground animate-in fade-in slide-in-from-top-1 px-4 pb-4 text-sm whitespace-pre-wrap">
            {email.body}
          </div>
        )}
      </div>

      {/* Zone B: Chain of Thought */}
      <div className="bg-muted/5 flex min-h-0 flex-1 flex-col border-b">
        <div className="bg-muted/10 text-muted-foreground flex items-center gap-2 border-b p-3 text-xs font-medium tracking-wider uppercase">
          <Bot className="h-3 w-3" />
          Agent Reasoning (CoT)
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 font-mono text-xs leading-relaxed">
            {cotSteps.map((step, index) => (
              <div
                key={index}
                className="animate-in fade-in flex gap-2 duration-500"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <span className="text-primary/50 select-none">›</span>
                <span>{step}</span>
              </div>
            ))}
            {!cotSteps.length && (
              <span className="text-muted-foreground italic">
                Waiting for analysis...
              </span>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Zone C: Draft Editor */}
      <div className="flex h-1/2 min-h-[300px] flex-col">
        <div className="bg-muted/10 flex items-center justify-between border-b p-3">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <PenLine className="h-3 w-3" />
            Draft Reply
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsEditing(!isEditing)}
              title="Edit"
            >
              <PenLine className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Regenerate"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4">
          {isEditing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-full resize-none font-sans"
            />
          ) : (
            <div className="bg-muted/20 h-full w-full overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap">
              {draft}
            </div>
          )}
        </div>

        <div className="bg-muted/10 flex justify-end gap-3 border-t p-4">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button
            onClick={handleApprove}
            className="gap-2"
            disabled={isApproving}
          >
            <Send className="h-4 w-4" />
            {isApproving ? 'Approving...' : 'Approve & Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
