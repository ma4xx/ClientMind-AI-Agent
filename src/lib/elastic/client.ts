import path from 'path';
import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

// Load environment variables if not already loaded (useful for scripts)
if (!process.env.ELASTIC_CLOUD_URL) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  dotenv.config({ path: envPath });
}

if (!process.env.ELASTIC_CLOUD_URL || !process.env.ELASTIC_API_KEY) {
  throw new Error(
    'Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY environment variables'
  );
}

export const elasticClient = new Client({
  node: process.env.ELASTIC_CLOUD_URL,
  auth: {
    apiKey: process.env.ELASTIC_API_KEY,
  },
});
