import { readLocalValue, writeLocalValue } from './local-storage';

export interface JsonStorage {
    read(key: string): unknown;
    write(key: string, value: unknown): boolean;
}
export const browserStorage: JsonStorage = { read: readLocalValue, write: writeLocalValue };
