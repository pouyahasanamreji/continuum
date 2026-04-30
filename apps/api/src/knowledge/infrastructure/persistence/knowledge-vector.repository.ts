export interface KnowledgeVectorMetadata {
  model: string;
  dim: number;
  url: string;
  signature: string;
  embeddedAt: number;
}

export abstract class KnowledgeVectorRepository {
  abstract upsert(
    knowledgeId: number,
    embedding: number[],
    metadata: KnowledgeVectorMetadata,
  ): void;
  abstract remove(knowledgeId: number): void;
  abstract recreateTable(newDim: number): void;
  abstract deleteAllRows(): void;
  abstract countRows(): number;
  abstract countRowsBySignature(signature: string): number;
  abstract currentDim(): number;
}
