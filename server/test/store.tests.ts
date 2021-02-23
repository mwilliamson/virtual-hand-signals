import assert from "assert";

import * as pg from "pg";

import * as store from "../lib/store";
import { SetResult } from "../lib/store";

suite(__filename, function () {
    createTestSuite("inMemory", async () => store.inMemory());

    createTestSuite("postgres", async () => {
        const pool = new pg.Pool({
            connectionString: "postgres://test:password1@127.0.0.1/bertram_test",
        });

        await pool.query("DROP TABLE IF EXISTS values");

        return store.postgres({
            pool: pool,
            tableName: "values",
        });
    });
});

interface Value {
    name: string;
}

function createTestSuite(name: string, createStore: () => Promise<store.Store<string, Value>>) {
    suite(name, function() {
        test("when store is empty then get() returns null value", async function () {
            const store = await createStore();

            const result = await store.get("abc");

            assert.strictEqual(result.value, undefined);
            assert.strictEqual(result.version, null);
        });

        test("when store does not have key then get() returns null value", async function () {
            const store = await createStore();
            await store.set("abc", null, {name: "Alice"});

            const result = await store.get("def");

            assert.strictEqual(result.value, undefined);
            assert.strictEqual(result.version, null);
        });

        test("when store does not have key then setting with null version allows get()", async function () {
            const store = await createStore();

            const setResult = await store.set("abc", null, {name: "Alice"});
            const getResult = await store.get("abc");

            assert.strictEqual(setResult, SetResult.Success);
            assert.deepStrictEqual(getResult.value, {name: "Alice"});
            assert.strictEqual(getResult.version, 1);
        });

        test("when setting with current version then version is incremented", async function () {
            const store = await createStore();
            await store.set("abc", null, {name: "Alice"});

            const setResult = await store.set("abc", 1, {name: "Bob"});
            const getResult = await store.get("abc");

            assert.strictEqual(setResult, SetResult.Success);
            assert.deepStrictEqual(getResult.value, {name: "Bob"});
            assert.strictEqual(getResult.version, 2);
        });

        test("when setting with wrong version then set() fails", async function () {
            const store = await createStore();
            await store.set("abc", null, {name: "Alice"});

            const setResult = await store.set("abc", 2, {name: "Bob"});
            const getResult = await store.get("abc");

            assert.strictEqual(setResult, SetResult.Stale);
            assert.deepStrictEqual(getResult.value, {name: "Alice"});
            assert.strictEqual(getResult.version, 1);
        });
    });
}
