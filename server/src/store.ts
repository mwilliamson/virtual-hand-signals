import * as pg from "pg";

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

export async function postgres<V>(options: {pool: pg.Pool, tableName: string}): Promise<Store<string, V>> {
    const {pool, tableName} = options;

    await pool.query(
        `
            CREATE TABLE IF NOT EXISTS "${tableName}" (
                key VARCHAR PRIMARY KEY,
                version INTEGER,
                value JSONB
            );
        `
    );

    // TODO: is higher isolation level necessary?

    async function get(key: string): Promise<GetResult<V>> {
        const {rows} = await pool.query(
            `SELECT value, version FROM "${tableName}" WHERE key = $1`,
            [key],
        );
        if (rows.length === 0) {
            return {
                value: undefined,
                version: null,
            };
        } else {
            return rows[0];
        }
    }

    async function set(key: string, expectedVersion: number | null, value: V): Promise<SetResult> {
        const {rowCount} = expectedVersion === null
            ? await pool.query(
                `
                    INSERT INTO "${tableName}" (key, version, value)
                    VALUES ($1, $2, $3)
                    ON CONFLICT
                    DO NOTHING
                `,
                [key, 1, value],
            )
            : await pool.query(
                `
                    UPDATE "${tableName}"
                    SET value = $3, version = version + 1
                    WHERE key = $1 AND version = $2
                `,
                [key, expectedVersion, value],
            );

        return rowCount === 0 ? SetResult.Stale : SetResult.Success;
    }

    return {
        get: get,
        set: set,
    };
}
