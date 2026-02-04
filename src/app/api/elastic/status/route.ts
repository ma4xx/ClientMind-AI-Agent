import { elasticClient } from '@/lib/elastic/client';
import { respData, respErr } from '@/shared/lib/resp';
import { v4 as uuidv4 } from 'uuid';

const INDICES = [
  'clientmind_events',
  'clientmind_drafts',
  'clientmind_knowledge',
  'clientmind_persona',
];

export async function POST() {
  try {
    const [health, counts] = await Promise.all([
      elasticClient.cluster.health(),
      Promise.all(
        INDICES.map(async (index) => {
          try {
            const response = await elasticClient.count({ index });
            return { index, count: response.count || 0 };
          } catch {
            return { index, count: 0 };
          }
        })
      ),
    ]);

    return respData({
      correlation_id: uuidv4(),
      status: health.status || 'unknown',
      cluster_name: health.cluster_name || '',
      indices: counts,
    });
  } catch (e: any) {
    console.log('elastic status failed:', e);
    return respErr('elastic status failed');
  }
}
