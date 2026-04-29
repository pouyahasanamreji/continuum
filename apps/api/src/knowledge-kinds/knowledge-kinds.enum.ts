export const KnowledgeKindEnum = {
  fundamental: 'fundamental',
  situational: 'situational',
} as const;
export type KnowledgeKindEnum =
  (typeof KnowledgeKindEnum)[keyof typeof KnowledgeKindEnum];
