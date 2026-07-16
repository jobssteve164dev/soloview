export type RecentDocument = {
  uri: string;
  name: string;
  parentPath: string;
  openedAt: number;
};

export interface RecentDocumentState {
  get<T>(key: string, fallback: T): T;
  update(key: string, value: unknown): PromiseLike<void>;
}

const storageKey = 'soloview.recentDocuments';

export class RecentDocuments {
  constructor(
    private readonly state: RecentDocumentState,
    private readonly limit = 12,
  ) {}

  list(): RecentDocument[] {
    return this.state
      .get<RecentDocument[]>(storageKey, [])
      .filter(isRecentDocument)
      .sort((left, right) => right.openedAt - left.openedAt)
      .slice(0, this.limit);
  }

  async add(document: RecentDocument): Promise<void> {
    const recent = this.list().filter((item) => item.uri !== document.uri);
    await this.state.update(storageKey, [document, ...recent].slice(0, this.limit));
  }

  async clear(): Promise<void> {
    await this.state.update(storageKey, []);
  }
}

function isRecentDocument(value: unknown): value is RecentDocument {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RecentDocument>;
  return typeof item.uri === 'string'
    && typeof item.name === 'string'
    && typeof item.parentPath === 'string'
    && typeof item.openedAt === 'number';
}
