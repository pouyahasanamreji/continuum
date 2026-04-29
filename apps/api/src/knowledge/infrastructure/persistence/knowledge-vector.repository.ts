export abstract class KnowledgeVectorRepository {
  abstract upsert(knowledgeId: number, embedding: number[]): void;
  abstract remove(knowledgeId: number): void;
}
