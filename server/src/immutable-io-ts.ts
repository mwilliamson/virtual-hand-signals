import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { List, OrderedMap } from "immutable";

export function list<C extends t.Mixed>(codec: C) {
    type Item = t.TypeOf<C>;
    type ItemOutput = t.OutputOf<C>;
    
    return new t.Type<List<Item>, Array<ItemOutput>, unknown>(
        `List<${codec.name}>`,
        (u: unknown): u is List<Item> => List.isList(u) && u.every(item => codec.is(item)),
        (u: unknown, context) => {
            const decodedArray = t.array(codec).validate(u, context);
            if (isLeft(decodedArray)) {
                return decodedArray;
            } else {
                return t.success(List(decodedArray.right));
            }
        },
        (l) => l.map(codec.encode).toArray(),
    );
}

export function orderedMap<KeyCodec extends t.Mixed, ValueCodec extends t.Mixed>(
    keyCodec: KeyCodec, valueCodec: ValueCodec
) {
    type Key = t.TypeOf<KeyCodec>;
    type KeyOutput = t.OutputOf<Key>;
    
    type Value = t.TypeOf<ValueCodec>;
    type ValueOutput = t.OutputOf<Value>;
    
    return new t.Type<OrderedMap<Key, Value>, Array<[KeyOutput, ValueOutput]>, unknown>(
        `OrderedMap<${keyCodec.name}, ${valueCodec.name}>`,
        (u: unknown): u is OrderedMap<Key, Value> =>
            OrderedMap.isOrderedMap(u) &&
                u.keySeq().every(key => keyCodec.is(key)) &&
                u.valueSeq().every(value => valueCodec.is(value)),
        (u: unknown, context) => {
            const decodedArray = t.array(t.tuple([keyCodec, valueCodec])).validate(u, context);
            if (isLeft(decodedArray)) {
                return decodedArray;
            } else {
                return t.success(OrderedMap(decodedArray.right));
            }
        },
        value => value.entrySeq().map(
            ([key, value]): [Key, Value] => [keyCodec.encode(key), valueCodec.encode(value)]
        ).toArray(),
    );    
}
