import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.ELASTIC_CLOUD_URL || !process.env.ELASTIC_API_KEY) {
  console.error(
    '❌ Missing ELASTIC_CLOUD_URL or ELASTIC_API_KEY in .env.local'
  );
  process.exit(1);
}

const client = new Client({
  node: process.env.ELASTIC_CLOUD_URL,
  auth: { apiKey: process.env.ELASTIC_API_KEY },
});

async function deployElser() {
  console.log('🔄 Checking ELSER model status...');
  const modelId = '.elser_model_2_linux-x86_64';

  try {
    // 1. Check if model is downloaded
    try {
      await client.ml.getTrainedModels({ model_id: modelId });
      console.log('✅ ELSER model found.');
    } catch (e: any) {
      // Only download if strictly "resource_not_found_exception" (404)
      if (e.meta?.statusCode === 404) {
        console.log('⬇️ Downloading ELSER model...');
        await client.ml.putTrainedModel({
          model_id: modelId,
          input: {
            field_names: ['text_field'],
          },
        });
      } else {
        throw e; // Re-throw other errors (Auth, Network, etc.)
      }
    }

    // 2. Check if deployment exists
    let isDeployed = false;
    try {
      const stats = await client.ml.getTrainedModelsStats({
        model_id: modelId,
      });
      // Check if there are any data_frame_analytics or inference_stats showing it's started
      // The API response structure for getTrainedModelsStats contains 'trained_model_stats' array
      // If the array is empty or the model state is 'stopped', we need to start it.

      const modelStats = stats.trained_model_stats?.find(
        (s) => s.model_id === modelId
      );

      if (
        modelStats &&
        modelStats.deployment_stats &&
        modelStats.deployment_stats.state === 'started'
      ) {
        isDeployed = true;
        console.log('✅ ELSER model is already deployed and started.');
      } else {
        console.log('ℹ️ ELSER model found but not started/deployed.');
      }
    } catch (e: any) {
      if (e.meta?.statusCode !== 404) {
        throw e;
      }
    }

    if (!isDeployed) {
      console.log('🚀 Deploying ELSER model...');
      // If it was already deployed but stopped, startTrainedModelDeployment should work (or we might need to stop first if stuck, but let's assume clean start)
      // Note: If it's 404 from getTrainedModelsStats, we definitely need to start.
      // If it exists but stopped, we also need to start.

      try {
        await client.ml.startTrainedModelDeployment({
          model_id: modelId,
          wait_for: 'fully_allocated',
        });
        console.log('✅ ELSER deployed successfully.');
      } catch (deployError: any) {
        // If it says "Conflict", it might be already starting or deployed in a race condition
        if (deployError.meta?.statusCode === 409) {
          console.log(
            '✅ ELSER deployment already in progress or completed (409 Conflict).'
          );
        } else {
          throw deployError;
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('⚠️ Error deploying ELSER:', message);
    // Optional: process.exit(1) if ELSER is critical and fails with non-recoverable error
  }
}

async function createPipeline() {
  console.log('🔄 Creating Ingest Pipeline: clientmind_pdf_processor...');

  const pipelineBody = {
    description: 'Extract text from PDF and generate embeddings using ELSER',
    processors: [
      {
        attachment: {
          field: 'data',
          target_field: 'attachment',
          indexed_chars: -1,
          properties: ['content', 'title'],
        },
      },
      {
        set: {
          field: 'content',
          value: '{{attachment.content}}',
        },
      },
      {
        inference: {
          model_id: '.elser_model_2_linux-x86_64',
          target_field: 'content_embedding',
          field_map: {
            content: 'text_field',
          },
        },
      },
      {
        remove: {
          field: ['data', 'attachment'],
        },
      },
    ],
  };

  try {
    // Check if pipeline exists
    try {
      await client.ingest.getPipeline({ id: 'clientmind_pdf_processor' });
      console.log(
        'ℹ️ Pipeline clientmind_pdf_processor already exists. Skipping creation.'
      );
    } catch (e: any) {
      if (e.meta?.statusCode === 404) {
        await client.ingest.putPipeline({
          id: 'clientmind_pdf_processor',
          description: pipelineBody.description,
          processors: pipelineBody.processors,
        });
        console.log('✅ Pipeline created successfully.');
      } else {
        throw e;
      }
    }
  } catch (error) {
    console.error('❌ Failed to create pipeline:', error);
  }
}

async function createIndices() {
  // Force re-creation of clientmind_knowledge to apply new mapping if needed
  // NOTE: In production, use reindex. Here we delete for dev speed.
  try {
    await client.indices.delete({
      index: 'clientmind_knowledge',
      ignore_unavailable: true,
    });
    console.log('🗑️ Deleted old clientmind_knowledge index to update mapping.');
  } catch (e) {} // ignore

  // Also update pipeline to ensure inference config is correct
  try {
    await client.ingest.putPipeline({
      id: 'clientmind_pdf_processor',
      description: 'Extract text from PDF and generate embeddings using ELSER',
      processors: [
        {
          attachment: {
            field: 'data',
            target_field: 'attachment',
            indexed_chars: -1,
            properties: ['content', 'title'],
          },
        },
        {
          set: {
            field: 'content',
            value: '{{attachment.content}}',
          },
        },
        {
          inference: {
            model_id: '.elser_model_2_linux-x86_64',
            target_field: 'content_embedding',
            field_map: {
              content: 'text_field',
            },
            inference_config: {
              // @ts-ignore - text_expansion is valid in ES 8.8+ but types might be outdated
              text_expansion: {
                results_field: 'predicted_value',
              },
            },
          },
        },
        {
          // ELSER outputs { predicted_value: { token: score, ... } } inside content_embedding
          // But rank_features expects { token: score, ... } directly at the field level.
          // The inference processor with text_expansion puts the result in target_field.predicted_value
          // We need to move content_embedding.predicted_value to content_embedding so it matches rank_features format.
          script: {
            source:
              'ctx.content_embedding = ctx.content_embedding.predicted_value',
          },
        },
        {
          remove: {
            field: ['data', 'attachment'],
          },
        },
      ],
    });
    console.log('✅ Pipeline updated with correct inference config.');
  } catch (e) {
    console.error('Pipeline update failed', e);
  }

  const indices: Array<{ name: string; mappings: Record<string, unknown> }> = [
    {
      name: 'clientmind_persona',
      mappings: {
        properties: {
          email: { type: 'keyword' },
          privacy_level: { type: 'keyword' },
          preferences: {
            properties: {
              style: { type: 'text' },
              allergies: { type: 'keyword' },
            },
          },
        },
      },
    },
    {
      name: 'clientmind_interactions',
      mappings: {
        properties: {
          email: { type: 'keyword' },
          timestamp: { type: 'date' },
          summary: { type: 'text' },
          embedding: {
            type: 'dense_vector',
            dims: 1536,
            index: true,
            similarity: 'cosine',
          },
        },
      },
      // NOTE: This index requires 1536-dim embeddings (e.g., OpenAI text-embedding-3-small).
      // The current script does not set up an Ingest Pipeline for this index.
      // Vectors should be generated in the application layer (via Vercel AI SDK) before indexing.
    },
    {
      name: 'clientmind_knowledge',
      mappings: {
        properties: {
          filename: { type: 'text' },
          content: { type: 'text' },
          // ELSER v2 outputs a map of { token: weight }, which matches 'sparse_vector' or 'rank_features'
          // However, for semantic_text or direct sparse_vector usage, we need to be careful with types.
          // The error "got unexpected token START_OBJECT" usually means the field type doesn't match the data.
          // ELSER output is indeed an object (map).
          // Let's verify if 'sparse_vector' is the correct type for ELSER v2 in ES 8.11+.
          // Actually, standard ELSER usage often uses 'sparse_vector' (deprecated/tech preview) or 'rank_features'.
          // But newer ES versions recommend 'semantic_text' or just 'sparse_vector' if enabled.
          // Let's try 'rank_features' which is more robust for sparse data, OR check ELSER docs.
          // Re-checking: ELSER produces a map of token->score.
          // 'sparse_vector' type expects a different format or is strict.
          // Let's try 'sparse_vector' but ensuring the inference processor output is compatible.
          // Wait, the error said: "fields take hashes that map a feature to a strictly positive float".
          // It seems it IS receiving an object.
          // Maybe the issue is with the specific type version.
          // Let's switch to 'rank_features' which is the standard storage for sparse vectors if 'sparse_vector' acts up,
          // OR better: Use 'sparse_vector' but check if we need to enable it specially.
          // Actually, 'sparse_vector' is for the specific sparse vector type.
          // Let's change to 'rank_features' as a safe fallback for ELSER if sparse_vector fails.
          // BUT 'sparse_vector' is preferred for retrieval.
          // Let's try 'sparse_vector' again but maybe the pipeline output structure is nested?
          // The inference processor puts the result in 'content_embedding'.
          // Let's try 'rank_features' first to see if it passes, as it's very compatible with ELSER output.
          content_embedding: { type: 'rank_features' },
          category: { type: 'keyword' },
          created_at: { type: 'date' },
        },
      },
    },
  ];

  for (const idx of indices) {
    console.log(`🔄 Creating index: ${idx.name}...`);
    try {
      const exists = await client.indices.exists({ index: idx.name });
      if (!exists) {
        await client.indices.create({
          index: idx.name,
          mappings: idx.mappings,
        });
        console.log(`✅ Index ${idx.name} created.`);

        if (idx.name === 'clientmind_interactions') {
          console.log(
            '⚠️ NOTE: clientmind_interactions uses dense_vector(1536). Ensure app layer generates embeddings (e.g., via OpenAI).'
          );
        }
      } else {
        console.log(`ℹ️ Index ${idx.name} already exists.`);
      }
    } catch (error) {
      console.error(`❌ Failed to create index ${idx.name}:`, error);
    }
  }
}

async function main() {
  await deployElser();
  await createPipeline();
  await createIndices();
  console.log('🎉 Initialization complete!');
}

main();
