import { getThemeBlock } from '@/core/theme';
import { type PageContent } from '@/themes/default/blocks/page-detail';

export default async function StaticPage({
  locale,
  post,
}: {
  locale?: string;
  post: PageContent;
}) {
  const PageDetail = await getThemeBlock('page-detail');

  return <PageDetail post={post} />;
}
