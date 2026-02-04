import dotenv from 'dotenv';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Load environment variables from .env.local BEFORE other imports
const envPath = path.resolve(__dirname, '../.env.local');
console.log(`Loading .env.local from: ${envPath}`);
const result = dotenv.config({ path: envPath });

import { elasticClient } from '../src/lib/elastic/client';

const INDEX_NAME = 'clientmind_knowledge';
const IDS_TO_DELETE = ['PVawA5wBdflY4F5YpQb3', 'M1Y8A5wBdflY4F5YEQZi'];

async function main() {
  try {
    console.log('Environment check:');
    console.log('ELASTIC_CLOUD_URL:', process.env.ELASTIC_CLOUD_URL ? 'Set' : 'Missing');

    console.log(`Deleting ${IDS_TO_DELETE.length} documents from index '${INDEX_NAME}'...`);

    let deletedCount = 0;
    for (const id of IDS_TO_DELETE) {
      try {
        const response = await elasticClient.delete({
          index: INDEX_NAME,
          id: id
        });
        console.log(`Deleted document ID: ${id}, Result: ${response.result}`);
        if (response.result === 'deleted') {
            deletedCount++;
        }
      } catch (err: any) {
        if (err?.meta?.statusCode === 404) {
            console.log(`Document ID: ${id} not found (already deleted?)`);
        } else {
            console.error(`Failed to delete document ID: ${id}`, err.message);
        }
      }
    }

    console.log(`\nOperation complete. Successfully deleted ${deletedCount} documents.`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();