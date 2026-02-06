import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env' });

if (!process.env.ELASTIC_CLOUD_URL || !process.env.ELASTIC_API_KEY) {
  console.error(
    '❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY in .env'
  );
  process.exit(1);
}

const client = new Client({
  node: process.env.ELASTIC_CLOUD_URL,
  auth: { apiKey: process.env.ELASTIC_API_KEY },
});

async function seedKnowledge() {
  const filePath = path.join(process.cwd(), 'scripts/data/sample-policy.md');
  const fileName = 'sample-policy.md';
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  console.log(`📤 Uploading ${fileName} to clientmind_knowledge index...`);

  try {
    const response = await client.index({
      index: 'clientmind_knowledge',
      pipeline: 'clientmind_pdf_processor', // Use the Ingest Pipeline
      document: {
        filename: fileName,
        data: base64Data, // Pipeline will extract content from this
        category: 'policy',
        created_at: new Date(),
      },
    });

    console.log(`✅ Document indexed. ID: ${response._id}`);
    
    // Allow some time for ELSER inference
    console.log('⏳ Waiting for ingestion and ELSER inference (2s)...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify
    const result = await client.get({
      index: 'clientmind_knowledge',
      id: response._id,
    });
    
    const source = result._source as any;
    console.log('\n🔍 Verification Result:');
    console.log(`- Extracted Content: "${source.content}"`);
    console.log(`- Embedding Generated: ${source.content_embedding ? 'YES (Sparse Vector)' : 'NO'}`);
    
    if (source.content_embedding) {
        console.log('🎉 Pipeline verification SUCCESSFUL!');
    } else {
        console.error('❌ Pipeline verification FAILED: No embedding generated.');
    }

  } catch (error) {
    console.error('❌ Error seeding knowledge:', error);
  }
}

seedKnowledge();
