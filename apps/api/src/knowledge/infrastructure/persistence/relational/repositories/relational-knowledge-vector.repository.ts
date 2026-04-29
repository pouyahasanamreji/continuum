import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { KnowledgeVectorRepository } from '../../knowledge-vector.repository';

@Injectable()
export class RelationalKnowledgeVectorRepository extends KnowledgeVectorRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  upsert(knowledgeId: number, embedding: number[]): void {
    if (embedding.length !== 768) {
      throw new Error(
        `knowledge_vec: dim mismatch (got ${embedding.length}, expected 768)`,
      );
    }
    const buf = Buffer.from(new Float32Array(embedding).buffer);
    const id = BigInt(knowledgeId);
    const tx = this.dbs.db.transaction(() => {
      this.dbs.db
        .prepare('DELETE FROM knowledge_vec WHERE knowledge_id = ?')
        .run(id);
      this.dbs.db
        .prepare(
          `INSERT INTO knowledge_vec (knowledge_id, embedding) VALUES (?, ?)`,
        )
        .run(id, buf);
    });
    tx();
  }

  remove(knowledgeId: number): void {
    this.dbs.db
      .prepare('DELETE FROM knowledge_vec WHERE knowledge_id = ?')
      .run(BigInt(knowledgeId));
  }
}
