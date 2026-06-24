ALTER TABLE "project_ai_config" ADD COLUMN IF NOT EXISTS "embedding_dimension" integer;
--> statement-breakpoint
ALTER TABLE "rag_chunk" ALTER COLUMN "embedding" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD COLUMN IF NOT EXISTS "embedding_384" vector(384);
--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD COLUMN IF NOT EXISTS "embedding_768" vector(768);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_chunk_embedding_384_hnsw_idx" ON "rag_chunk" USING hnsw ("embedding_384" vector_cosine_ops) WHERE "embedding_384" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_chunk_embedding_768_hnsw_idx" ON "rag_chunk" USING hnsw ("embedding_768" vector_cosine_ops) WHERE "embedding_768" IS NOT NULL;
