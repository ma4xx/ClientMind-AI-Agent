'use client';

import { useTranslations } from 'next-intl';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { AgentConsole } from '@/shared/blocks/dashboard/console/agent-console';
import { type Crumb } from '@/shared/types/blocks/common';

export default function OperationsDraftsPage() {
  const t = useTranslations('admin.operations');

  const crumbs: Crumb[] = [
    { title: t('crumbs.admin'), url: '/admin' },
    { title: t('crumbs.operations'), url: '/admin/operations/drafts', is_active: true },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('drafts.title')} description={t('drafts.description')} />
        <div className="min-h-[70vh]">
          <AgentConsole />
        </div>
      </Main>
    </>
  );
}
