export interface ICache<K, V> {
  get(key: K): V | undefined;
  has(key: K): boolean;
  set(key: K, data: V): void;
  del(key: K): void;
  clear(): void;
}
