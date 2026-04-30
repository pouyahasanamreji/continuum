import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import {
  KnowledgeVectorMetadata,
  KnowledgeVectorRepository,
} from '../../knowledge-vector.repository';

@Injectable()
export class RelationalKnowledgeVectorRepository extends KnowledgeVectorRepository {
  private cachedDim: number | null = null;

  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  upsert(
    knowledgeId: number,
    embedding: number[],
    metadata: KnowledgeVectorMetadata,
  ): void {
    const expected = this.dim();
    if (embedding.length !== expected) {
      throw new Error(
        `knowledge_vec: dim mismatch (got ${embedding.length}, expected ${expected})`,
      );
    }
    if (metadata.dim !== embedding.length) {
      throw new Error(
        `knowledge_vec: metadata dim mismatch (got ${metadata.dim}, embedding ${embedding.length})`,
      );
    }
    const buf = Buffer.from(new Float32Array(embedding).buffer);
    const id = BigInt(knowledgeId);
    const tx = this.dbs.db.transaction(() => {
      this.dbs.db
        .prepare('DELETE FROM knowledge_vec WHERE knowledge_id = ?')
        .run(id);
      this.dbs.db
        .prepare('DELETE FROM knowledge_vec_meta WHERE knowledge_id = ?')
        .run(knowledgeId);
      this.dbs.db
        .prepare(
          `INSERT INTO knowledge_vec (knowledge_id, embedding, embedder_signature)
           VALUES (?, ?, ?)`,
        )
        .run(id, buf, metadata.signature);
      this.dbs.db
        .prepare(
          `INSERT INTO knowledge_vec_meta (
             knowledge_id, embedder_model, embedder_dim, embedder_url,
             embedder_signature, embedded_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          knowledgeId,
          metadata.model,
          metadata.dim,
          metadata.url,
          metadata.signature,
          metadata.embeddedAt,
        );
    });
    tx();
  }

  remove(knowledgeId: number): void {
    const tx = this.dbs.db.transaction(() => {
      this.dbs.db
        .prepare('DELETE FROM knowledge_vec WHERE knowledge_id = ?')
        .run(BigInt(knowledgeId));
      this.dbs.db
        .prepare('DELETE FROM knowledge_vec_meta WHERE knowledge_id = ?')
        .run(knowledgeId);
    });
    tx();
  }

  countRows(): number {
    const row = this.dbs.db
      .prepare(`SELECT COUNT(*) AS c FROM knowledge_vec`)
      .get() as { c: number };
    return row.c;
  }

  countRowsBySignature(signature: string): number {
    const row = this.dbs.db
      .prepare(
        `SELECT COUNT(*) AS c FROM knowledge_vec WHERE embedder_signature = ?`,
      )
      .get(signature) as { c: number };
    return row.c;
  }

  currentDim(): number {
    return this.dim();
  }

  deleteAllRows(): void {
    // Trigger watches knowledge, NOT knowledge_vec — does not fire here.
    this.dbs.db.exec(
      `DELETE FROM knowledge_vec; DELETE FROM knowledge_vec_meta;`,
    );
  }

  /**
   * Non-atomic by design. vec0 + DDL inside one SQLite transaction carries
   * partial-state risk (extension shadow tables). The 3-step sequence is
   * best-effort and idempotent on re-run thanks to IF EXISTS.
   */
  recreateTable(newDim: number): void {
    if (newDim < 1 || newDim > 4096) {
      throw new Error(`knowledge_vec: invalid dim ${newDim} (must be 1..4096)`);
    }
    this.dbs.db.exec(`DROP TRIGGER IF EXISTS knowledge_vec_cleanup;`);
    this.dbs.db.exec(`DROP TABLE IF EXISTS knowledge_vec;`);
    this.dbs.db.exec(`DELETE FROM knowledge_vec_meta;`);
    this.dbs.db.exec(
      `CREATE VIRTUAL TABLE knowledge_vec USING vec0(knowledge_id INTEGER PRIMARY KEY, embedding FLOAT[${newDim}], embedder_signature TEXT);`,
    );
    this.dbs.db.exec(
      `CREATE TRIGGER knowledge_vec_cleanup AFTER DELETE ON knowledge BEGIN DELETE FROM knowledge_vec WHERE knowledge_id = OLD.id; END;`,
    );
    this.cachedDim = newDim;
  }

  private dim(): number {
    if (this.cachedDim === null) {
      this.cachedDim = this.readDimFromSqliteMaster();
    }
    return this.cachedDim;
  }

  private readDimFromSqliteMaster(): number {
    const row = this.dbs.db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_vec'`,
      )
      .get() as { sql?: string } | undefined;
    const m = row?.sql?.match(/FLOAT\[(\d+)\]/);
    return m ? Number.parseInt(m[1], 10) : 0;
  }
}
