import { pipe } from "fp-ts/function";
import * as A from "fp-ts/Array";

export default function permutations<T>(as: T[]): T[][] {
  if (as.length === 0) return [[]];

  return pipe(
    as,
    A.chain((a, i) =>
      pipe(
        [...as.slice(0, i), ...as.slice(i + 1)],
        permutations,
        A.map((rest) => [a, ...rest]),
      ),
    ),
  );
}
