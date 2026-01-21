import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private embedder: any = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private readonly embeddingDimension = 384;

  /**
   * Initialize the embedding model on module startup
   * First run will download ~25MB model from Hugging Face
   */
  async onModuleInit() {
    try {
      this.logger.log('Loading embedding model...');
      this.embedder = await pipeline('feature-extraction', this.modelName);
      this.logger.log(`Embedding model loaded successfully: ${this.modelName}`);
    } catch (error) {
      this.logger.error('Failed to load embedding model', error.stack);
      throw error;
    }
  }

  /**
   * Generate embedding vector for text
   * @param text - Text to embed (recommended: <512 tokens)
   * @returns 384-dimensional vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      // Truncate text to max 512 tokens (roughly 2000 characters)
      const truncatedText = text.slice(0, 2000);

      // Generate embedding with mean pooling and normalization
      const output = await this.embedder(truncatedText, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      const embedding = Array.from(output.data) as number[];

      // Verify dimension
      if (embedding.length !== this.embeddingDimension) {
        throw new Error(
          `Expected ${this.embeddingDimension} dimensions, got ${embedding.length}`,
        );
      }

      return embedding;
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling generateEmbedding multiple times
   * @param texts - Array of texts to embed
   * @returns Array of 384-dimensional vectors
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    try {
      // Truncate each text to max 512 tokens
      const truncatedTexts = texts.map((text) => text.slice(0, 2000));

      // Generate embeddings in batch
      const output = await this.embedder(truncatedTexts, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert to array of arrays
      const embeddings: number[][] = [];
      for (let i = 0; i < texts.length; i++) {
        const start = i * this.embeddingDimension;
        const end = start + this.embeddingDimension;
        embeddings.push(Array.from(output.data.slice(start, end)));
      }

      return embeddings;
    } catch (error) {
      this.logger.error(`Failed to generate batch embeddings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param embedding1 - First embedding vector
   * @param embedding2 - Second embedding vector
   * @returns Similarity score (0-1, higher is more similar)
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Chunk large text into smaller pieces for embedding
   * Each chunk will be embedded separately
   * @param text - Text to chunk
   * @param maxChunkSize - Maximum characters per chunk
   * @param overlap - Number of characters to overlap between chunks
   * @returns Array of text chunks
   */
  chunkText(text: string, maxChunkSize = 1500, overlap = 200): string[] {
    const chunks: string[] = [];
    let position = 0;

    while (position < text.length) {
      const chunk = text.slice(position, position + maxChunkSize);
      chunks.push(chunk);
      position += maxChunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    return this.embeddingDimension;
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.embedder !== null;
  }
}
