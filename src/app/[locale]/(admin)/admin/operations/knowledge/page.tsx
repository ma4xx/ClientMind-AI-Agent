'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Search,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { type Crumb } from '@/shared/types/blocks/common';

type KnowledgeResult = {
  id: string;
  file: string;
  segment: string;
  score: number;
};

export default function OperationsKnowledgePage() {
  const t = useTranslations('pages.knowledge');
  const tOps = useTranslations('admin.operations');
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const response = await fetch('/api/user/get-user-info', {
        method: 'POST',
      });
      const payload = await response.json();
      setIsAuthed(response.ok && payload.code === 0);
    };
    checkAuth();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      setStatus('error');
      setMessage(t('errors.fileType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus('error');
      setMessage(t('errors.fileSize'));
      return;
    }
    setFile(file);
    setStatus('idle');
    setMessage('');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus('idle');
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || t('errors.generic'));
      }

      setStatus('success');
      setMessage(t('messages.success'));
      setFile(null);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || t('errors.generic'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query_text: query, top_k: 5 }),
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || t('messages.error'));
      }
      const hits: KnowledgeResult[] = (payload.data?.hits || []).map(
        (hit: any) => ({
          id: hit.chunk_id || hit.id || hit._id || '',
          file: hit.source || hit.metadata?.source || '',
          segment: hit.chunk_text || '',
          score: hit.score || 0,
        })
      );
      setResults(hits);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || t('messages.error'));
    } finally {
      setIsSearching(false);
    }
  };

  const crumbs: Crumb[] = [
    { title: tOps('crumbs.admin'), url: '/admin' },
    {
      title: tOps('crumbs.operations'),
      url: '/admin/operations/knowledge',
      is_active: true,
    },
  ];

  if (isAuthed === false) {
    return <Empty message={t('errors.unauthorized')} />;
  }

  if (isAuthed === null) {
    return null;
  }

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title={tOps('knowledge.title')}
          description={tOps('knowledge.description')}
        />
        <div className="flex flex-col gap-6 p-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>

          <div
            className={`border-muted-foreground/25 hover:bg-muted/5 bg-card flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/10' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="bg-primary/10 mb-4 rounded-full p-4">
              <Upload className="text-primary h-8 w-8" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t('dropzone.text')}</h3>
            <p className="text-muted-foreground max-w-sm text-sm">
              {t('dropzone.subtext')}
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="mt-4">
              <Button variant="outline" asChild className="cursor-pointer">
                <span>{t('dropzone.button')}</span>
              </Button>
            </label>
            {file && (
              <div className="text-foreground bg-background mt-4 flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-medium shadow-sm">
                <FileText className="text-primary h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>

          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-md border p-3 text-sm">
              <AlertCircle className="h-4 w-4" />
              {message}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('button.uploading')}
              </>
            ) : (
              t('button.idle')
            )}
          </Button>

          <div className="flex items-center gap-4">
            <div className="relative max-w-xl flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder={t('search.placeholder')}
                className="bg-background pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? t('search.searching') : t('search.button')}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('search.resultsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!results.length && (
                <div className="text-muted-foreground text-sm">
                  {t('search.empty')}
                </div>
              )}
              {results.map((hit) => (
                <div key={hit.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="truncate text-sm font-medium">
                      {hit.file}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {(hit.score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-2 text-xs whitespace-pre-wrap">
                    {hit.segment}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  );
}
