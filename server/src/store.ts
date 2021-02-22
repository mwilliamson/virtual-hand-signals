export interface Store<K, V> {
    get: (key: K) => Promise<GetResult<V>>;
    set: (key: K, previousVersion: number | null, value: V) => Promise<SetResult>;
}

export interface GetResult<V> {
    value: V | undefined;
    version: number | null;
}

export enum SetResult {
    Success,
    Stale,
}

export function inMemory<K, V>(): Store<K, V> {
    interface VersionedValue {
        value: V;
        version: number;
    }

    const map = new Map<K, VersionedValue>();
    return {
        get: async (key) => {
            const value = map.get(key);
            return value ?? {value: undefined, version: null};
        },
        set: async (key, expectedVersion, value) => {
            const currentVersion = map.get(key)?.version ?? null;
            if (currentVersion === expectedVersion) {
                const newVersion = currentVersion === null ? 1 : currentVersion + 1;
                map.set(key, {value: value, version: newVersion});
                return SetResult.Success;
            } else {
                return SetResult.Stale;
            }
        },
    };
}
