export interface ICache<K, V> {
  get(key: K): V | undefined;
  has(key: K): boolean;
  set(key: K, data: V): void;
  del(key: K): void;
  /**
   * May be async when clearing also removes persisted state; callers that
   * need the cache to be gone must await the result.
   */
  clear(): void | Promise<void>;
}
