import { Database, FileText, User } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

import { KnowledgeHit, PersonaTag } from './types';

interface MemoryBrainProps {
  tags: PersonaTag[];
  hits: KnowledgeHit[];
  isLoading?: boolean;
}

export function MemoryBrain({ tags, hits, isLoading }: MemoryBrainProps) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        Loading Brain Data...
      </div>
    );
  }

  if (!tags.length && !hits.length) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-center">
        Select an email to activate the Dual-RAG Brain.
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col border-r">
      <div className="border-b p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Memory Brain
          <Database className="text-primary h-4 w-4" />
        </h2>
        <p className="text-muted-foreground text-xs">
          Elasticsearch Dual-RAG Retrieval
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Persona Memory Zone */}
          <div className="space-y-3">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Persona Memory
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <TagItem key={tag.id} tag={tag} />
              ))}
            </div>
          </div>

          {/* Knowledge Hits Zone */}
          <div className="space-y-3">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Knowledge Hits
            </div>
            <div className="space-y-3">
              {hits.map((hit) => (
                <HitCard key={hit.id} hit={hit} />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function TagItem({ tag }: { tag: PersonaTag }) {
  const colorClass = {
    warning: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200',
    opportunity:
      'bg-green-100 text-green-700 hover:bg-green-200 border-green-200',
    basic: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
    history: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200',
  }[tag.type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              'cursor-help rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              colorClass
            )}
          >
            {tag.label}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Source: {tag.source}</p>
          <p className="text-muted-foreground text-xs">{tag.date}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HitCard({ hit }: { hit: KnowledgeHit }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between">
          <div
            className="text-primary w-2/3 truncate text-xs font-medium"
            title={hit.file}
          >
            {hit.file}
          </div>
          <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
            Score: {(hit.score * 100).toFixed(0)}%
            <div className="bg-muted h-1.5 w-8 overflow-hidden rounded-full">
              <div
                className="h-full bg-green-500"
                style={{ width: `${hit.score * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="text-muted-foreground bg-muted/50 border-primary/20 rounded border-l-2 p-2 text-xs italic">
          &quot;{hit.segment}&quot;
        </div>
      </CardContent>
    </Card>
  );
}
