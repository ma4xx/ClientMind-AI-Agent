'use client';

import { useEffect, useState } from 'react';
import { Bot, Link as LinkIcon, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { type Crumb } from '@/shared/types/blocks/common';

type ElasticStatus = {
  status: string;
  cluster_name: string;
  indices: { index: string; count: number }[];
};

type PersonaConfig = {
  agent_name?: string;
  tone?: 'friendly' | 'professional';
  auto_send?: boolean;
};

export default function OperationsSettingsPage() {
  const t = useTranslations('admin.operations');
  const defaultAgentName = t('settings.defaults.agentName');
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [elasticStatus, setElasticStatus] = useState<ElasticStatus | null>(
    null
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [agentName, setAgentName] = useState(defaultAgentName);
  const [tone, setTone] = useState<'friendly' | 'professional'>('friendly');
  const [autoSend, setAutoSend] = useState(false);
  const [isLoadingPersona, setIsLoadingPersona] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/elastic/status', { method: 'POST' });
      const payload = await response.json();
      if (response.ok && payload.code === 0) {
        setElasticStatus(payload.data);
      } else {
        setElasticStatus(null);
      }
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchPersona = async (email: string) => {
    setIsLoadingPersona(true);
    try {
      const response = await fetch('/api/persona/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_email: email }),
      });
      const payload = await response.json();
      if (response.ok && payload.code === 0) {
        const config: PersonaConfig = payload.data?.persona_config || {};
        setAgentName(config.agent_name || defaultAgentName);
        setTone(config.tone || 'friendly');
        setAutoSend(Boolean(config.auto_send));
      }
    } finally {
      setIsLoadingPersona(false);
    }
  };

  const handleSave = async () => {
    if (!userEmail) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/persona/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: userEmail,
          persona_config: {
            agent_name: agentName.trim(),
            tone,
            auto_send: autoSend,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || t('settings.toastError'));
      }
      toast.success(t('settings.toastSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.toastError'));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const response = await fetch('/api/user/get-user-info', {
        method: 'POST',
      });
      const payload = await response.json();
      const authed = response.ok && payload.code === 0;
      setIsAuthed(authed);
      if (authed) {
        const email = payload.data?.email || '';
        setUserEmail(email);
        if (email) {
          fetchPersona(email);
        }
      }
    };
    checkAuth();
    fetchStatus();
  }, []);

  const crumbs: Crumb[] = [
    { title: t('crumbs.admin'), url: '/admin' },
    {
      title: t('crumbs.operations'),
      url: '/admin/operations/settings',
      is_active: true,
    },
  ];

  if (isAuthed === false) {
    return <Empty message={t('settings.errors.noAuth')} />;
  }

  if (isAuthed === null) {
    return null;
  }

  const indices = elasticStatus?.indices || [];
  const knowledgeCount =
    indices.find((entry) => entry.index === 'clientmind_knowledge')?.count || 0;

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title={t('settings.title')}
          description={t('settings.description')}
        />
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('settings.pageTitle')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('settings.pageDescription')}
            </p>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="text-primary h-5 w-5" />
                  <CardTitle>
                    {t('settings.cards.agentPersona.title')}
                  </CardTitle>
                </div>
                <CardDescription>
                  {t('settings.cards.agentPersona.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">
                      {t('settings.cards.agentPersona.nameLabel')}
                    </Label>
                    <Input
                      id="agent-name"
                      placeholder={t(
                        'settings.cards.agentPersona.namePlaceholder'
                      )}
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('settings.cards.agentPersona.nameHelper')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.cards.agentPersona.toneLabel')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className={`flex cursor-pointer items-center justify-between rounded-md border-2 p-3 ${
                          tone === 'friendly'
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent border'
                        }`}
                        onClick={() => setTone('friendly')}
                      >
                        <span className="text-sm font-medium">
                          {t('settings.cards.agentPersona.tone.friendly')}
                        </span>
                        {tone === 'friendly' && (
                          <div className="bg-primary h-2 w-2 rounded-full" />
                        )}
                      </div>
                      <div
                        className={`flex cursor-pointer items-center justify-between rounded-md border-2 p-3 ${
                          tone === 'professional'
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent border'
                        }`}
                        onClick={() => setTone('professional')}
                      >
                        <span className="text-sm font-medium">
                          {t('settings.cards.agentPersona.tone.professional')}
                        </span>
                        {tone === 'professional' && (
                          <div className="bg-primary h-2 w-2 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted rounded-md p-4">
                  <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                    {t('settings.cards.agentPersona.tonePreviewLabel')}
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                      AI
                    </div>
                    <div className="bg-background rounded-lg border p-3 text-sm shadow-sm">
                      {t('settings.cards.agentPersona.tonePreviewMessage')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LinkIcon className="text-primary h-5 w-5" />
                  <CardTitle>
                    {t('settings.cards.dataConnection.title')}
                  </CardTitle>
                </div>
                <CardDescription>
                  {t('settings.cards.dataConnection.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-card flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {t('settings.cards.dataConnection.memoryEngine')}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t('settings.cards.dataConnection.clusterLabel', {
                        name: elasticStatus?.cluster_name || '-',
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-2 w-2 rounded-full ${
                        elasticStatus?.status === 'green'
                          ? 'bg-green-500'
                          : elasticStatus?.status === 'yellow'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm font-medium text-green-700">
                      {isLoadingStatus
                        ? t('settings.cards.dataConnection.status.loading')
                        : elasticStatus?.status ||
                          t('settings.cards.dataConnection.status.unknown')}
                    </span>
                  </div>
                </div>

                <div className="bg-card flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {t('settings.cards.dataConnection.knowledgeIndexTitle')}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t('settings.cards.dataConnection.knowledgeIndexLabel', {
                        count: knowledgeCount,
                      })}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchStatus}>
                    {t('settings.cards.dataConnection.syncNow')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-primary h-5 w-5" />
                  <CardTitle>{t('settings.cards.safety.title')}</CardTitle>
                </div>
                <CardDescription>
                  {t('settings.cards.safety.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">
                      {t('settings.cards.safety.autoSendLabel')}
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      {t('settings.cards.safety.autoSendDescription')}
                    </p>
                  </div>
                  <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={isSaving || isLoadingPersona}
              >
                {isSaving ? t('settings.saving') : t('settings.save')}
              </Button>
            </div>
          </div>
        </div>
      </Main>
    </>
  );
}
