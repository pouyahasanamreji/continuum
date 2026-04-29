export abstract class KnowledgeVectorRepository {
  abstract upsert(knowledgeId: number, embedding: number[]): void;
  abstract remove(knowledgeId: number): void;
  abstract recreateTable(newDim: number): void;
  abstract deleteAllRows(): void;
  abstract countRows(): number;
  abstract currentDim(): number;
}
