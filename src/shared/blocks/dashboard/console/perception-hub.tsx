import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { EmailItem } from './types';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

interface PerceptionHubProps {
  emails: EmailItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PerceptionHub({ emails, selectedId, onSelect }: PerceptionHubProps) {
  const [filter, setFilter] = useState<'all' | 'pending'>('all');

  const filteredEmails = filter === 'all' 
    ? emails 
    : emails.filter(e => e.status === 'pending');

  return (
    <div className="flex h-full flex-col border-r bg-muted/10">
      <div className="p-4 border-b space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          Perception Hub
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {emails.filter(e => e.status === 'pending').length} Pending
          </Badge>
        </h2>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search emails..." className="pl-8" />
        </div>
        <div className="flex gap-2">
           <Button 
             variant={filter === 'all' ? 'secondary' : 'ghost'} 
             size="sm" 
             onClick={() => setFilter('all')}
             className="flex-1"
           >
             All
           </Button>
           <Button 
             variant={filter === 'pending' ? 'secondary' : 'ghost'} 
             size="sm" 
             onClick={() => setFilter('pending')}
             className="flex-1"
           >
             Pending Only
           </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {filteredEmails.map((email) => (
            <button
              key={email.id}
              onClick={() => onSelect(email.id)}
              className={cn(
                "flex flex-col items-start gap-2 p-4 text-left text-sm transition-all hover:bg-accent",
                selectedId === email.id && "bg-accent"
              )}
            >
              <div className="flex w-full flex-col gap-1">
                <div className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2",
                      email.isVip ? "border-yellow-400" : "border-transparent bg-muted"
                    )}>
                       <span className="font-semibold text-xs">{email.avatar}</span>
                    </div>
                    <div className="font-semibold">{email.name}</div>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground">
                    {email.time}
                  </div>
                </div>
                <div className="text-xs font-medium">{email.subject}</div>
              </div>
              <div className="line-clamp-2 text-xs text-muted-foreground">
                {email.snippet}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getIntentBadgeVariant(email.intent)}>
                  {email.intent}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function getIntentBadgeVariant(intent: string): "default" | "secondary" | "destructive" | "outline" {
  switch (intent) {
    case 'Sales Inquiry':
      return 'default'; // High priority/Sales
    case 'Support':
      return 'secondary';
    case 'Logistics':
    case 'Refund':
      return 'outline';
    default:
      return 'secondary';
  }
}
