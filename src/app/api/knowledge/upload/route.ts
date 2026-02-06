import { NextRequest, NextResponse } from 'next/server';
import { elasticClient } from '@/lib/elastic/client';
import { v4 as uuidv4 } from 'uuid';

import { getSignUser } from '@/shared/models/user';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

export async function POST(req: NextRequest) {
  try {
    const user = await getSignUser();
    if (!user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: 'You must be logged in to upload files.',
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const metaRaw = formData.get('metadata');
    let meta: any = {};
    if (typeof metaRaw === 'string') {
      try {
        meta = JSON.parse(metaRaw);
      } catch {}
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          details: 'Only PDF files are supported.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          details: 'File size must be less than 10MB.',
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const simulate = await elasticClient.transport.request(
      {
        method: 'POST',
        path: '/_ingest/pipeline/clientmind_pdf_processor/_simulate',
        body: {
          docs: [{ _source: { data: base64Data } }],
        },
      },
      { meta: true }
    );
    const simBody: any = simulate.body;
    const simDoc =
      simBody?.docs?.[0]?.doc?._source || simBody?.docs?.[0]?._source || {};
    const content: string = simDoc?.content || '';
    if (!content || content.length === 0) {
      return NextResponse.json(
        { error: 'Content extraction failed' },
        { status: 500 }
      );
    }

    function chunkText(text: string, size: number, overlap: number) {
      const words = text.split(/\s+/).filter(Boolean);
      const chunks: string[] = [];
      let i = 0;
      while (i < words.length) {
        const slice = words.slice(i, i + size);
        chunks.push(slice.join(' '));
        if (i + size >= words.length) break;
        i += Math.max(1, size - overlap);
      }
      return chunks;
    }

    const uploadId = uuidv4();
    const chunks = chunkText(content, 800, 200);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await elasticClient.index({
        index: 'clientmind_knowledge',
        pipeline: 'clientmind_chunk_processor',
        document: {
          chunk_id: `${uploadId}-${i}`,
          source: file.name,
          chunk_text: chunk,
          metadata: {
            doc_type: meta?.doc_type || 'pdf',
            uploaded_at: new Date(),
            uploaded_by: user.id,
            doc_version: meta?.doc_version || '',
            file_size: file.size,
          },
        },
      });
    }

    return NextResponse.json({
      document_id: uploadId,
      status: 'indexed',
      chunks_count: chunks.length,
    });
  } catch (error: any) {
    console.error('Upload error details:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error.message || 'An unexpected error occurred. Please try again later.',
        meta: error.meta?.body || error.meta || null
      },
      { status: 500 }
    );
  }
}
