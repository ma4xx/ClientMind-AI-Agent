'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useTranslations } from 'next-intl';

export default function KnowledgePage() {
  const t = useTranslations('pages.knowledge'); // Matches namespace in messages/en/pages/knowledge.json
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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
      console.error('Upload error:', error);
      setStatus('error');
      setMessage(error.message || t('errors.generic'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div 
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/10' 
                : 'border-muted-foreground/25 hover:border-primary/50 bg-muted/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className={`h-10 w-10 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {t('dropzone.text')}
              <br />
              {t('dropzone.subtext')}
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="outline" asChild className="cursor-pointer">
                <span>{t('dropzone.button')}</span>
              </Button>
            </label>
            {file && (
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-foreground bg-background px-3 py-1 rounded-md border shadow-sm">
                <FileText className="h-4 w-4 text-primary" />
                {file.name}
              </div>
            )}
          </div>

          {status === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
              <CheckCircle className="h-4 w-4" />
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
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
        </CardContent>
      </Card>
    </div>
  );
}
