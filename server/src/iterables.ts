export function toMultiMap<K, V>(entries: Array<[K, V]>): Map<K, Array<V>> {
    const result = new Map<K, Array<V>>();

    for (const [key, value] of entries) {
        let outputArray = result.get(key);
        if (outputArray === undefined) {
            result.set(key, [value]);
        } else {
            outputArray.push(value);
        }
    }

    return result;
}
