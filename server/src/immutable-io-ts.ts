import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { List } from "immutable";

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
