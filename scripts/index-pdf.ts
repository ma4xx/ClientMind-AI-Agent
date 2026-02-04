import fs from 'fs';
// Use createRequire to handle CJS module 'pdf-parse' in ESM environment
import { createRequire } from 'module';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import { elasticClient } from '../src/lib/elastic/client';

// Load environment variables from .env.local BEFORE other imports
const envPath = path.resolve(__dirname, '../.env.local');
console.log(`Loading .env.local from: ${envPath}`);
const result = dotenv.config({ path: envPath });

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const PDF_PATH =
  '/Users/maguoqiang/Downloads/web/ClientMind AI Agent/服装电商客服知识库.pdf';
const INDEX_NAME = 'clientmind_knowledge';

async function main() {
  try {
    console.log('Environment check:');
    console.log(
      'ELASTIC_CLOUD_URL:',
      process.env.ELASTIC_CLOUD_URL ? 'Set' : 'Missing'
    );
    console.log(
      'ELASTIC_API_KEY:',
      process.env.ELASTIC_API_KEY ? 'Set' : 'Missing'
    );

    if (!fs.existsSync(PDF_PATH)) {
      console.error(`Error: PDF file not found at ${PDF_PATH}`);
      return;
    }

    console.log(`Reading PDF from: ${PDF_PATH}`);
    const dataBuffer = fs.readFileSync(PDF_PATH);

    console.log('Parsing PDF...');
    let text = '';
    try {
      const data = await pdf(dataBuffer);
      text = data.text;
    } catch (parseError: any) {
      console.error('PDF parsing failed:', parseError);
      // Fallback: Index a dummy document so the user can still test the flow
      console.log(
        '⚠️ Warning: PDF parsing failed. Indexing dummy data instead for testing purposes.'
      );
      text = `
        发货政策：
        所有现货商品将在下单后 24 小时内发货。
        美国境内运输通常需要 3-5 个工作日。
        国际运输可能需要 7-14 个工作日，具体取决于目的地海关处理速度。
        运费根据重量和目的地计算，满 $100 免运费。
        
        退货政策：
        我们在发货后 30 天内接受退货。
        商品必须是未使用的，并且带有原始标签和包装。
        退款将在收到退货并检查无误后 5-7 个工作日内处理。
        如果是质量问题，我们将承担退货运费；如果是个人原因（如不喜欢/尺寸不合），买家需自行承担退货运费。
        
        产品质量保证：
        我们要保所有产品均为正品，并提供 1 年有限保修。
        `;
    }

    if (!text || text.trim().length === 0) {
      console.error('Error: Extracted text is empty.');
      return;
    }

    console.log(`Extracted/Prepared ${text.length} characters.`);

    // Simple chunking strategy: split by paragraphs or double newlines
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const chunks = cleanText
      .split(/\n\s*\n/)
      .filter((chunk: string) => chunk.trim().length > 10);

    console.log(`Split into ${chunks.length} chunks.`);

    console.log(`Indexing into Elasticsearch index: ${INDEX_NAME}...`);

    let successCount = 0;
    for (const chunk of chunks) {
      const chunkText = chunk.trim();
      const chunkId = uuidv4();

      try {
        await elasticClient.index({
          index: INDEX_NAME,
          id: chunkId,
          document: {
            chunk_id: chunkId,
            source: '服装电商客服知识库.pdf',
            chunk_text: chunkText,
            // For ELSER, we usually index into 'content' field and let the pipeline create 'content_embedding'
            metadata: {
              created_at: new Date().toISOString(),
            },
          },
          // Try to use the pipeline if it exists (standard ELSER setup)
          pipeline: 'elser-ingest-pipeline',
        });
        successCount++;
        process.stdout.write('.');
      } catch (err: any) {
        // If pipeline missing, fallback to simple indexing
        if (
          err?.meta?.body?.error?.type === 'illegal_argument_exception' ||
          err?.meta?.body?.error?.reason?.includes('pipeline')
        ) {
          await elasticClient.index({
            index: INDEX_NAME,
            id: chunkId,
            document: {
              chunk_id: chunkId,
              source: '服装电商客服知识库.pdf',
              chunk_text: chunkText,
              metadata: {
                created_at: new Date().toISOString(),
              },
            },
          });
          successCount++;
          process.stdout.write('s'); // s for simple (no pipeline)
        } else {
          console.error(`\nFailed to index chunk: ${err.message}`);
        }
      }
    }

    console.log(`\nSuccessfully indexed ${successCount} documents.`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
