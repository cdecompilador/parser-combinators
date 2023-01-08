export enum Result {
  Ok,
  Error,
}

export interface ParseResult<T> {
  state: Result;
  remainder: string;
  value?: T;
  error?: string;
}

export abstract class Parser<T> {
  abstract parse(input: string): ParseResult<T>;

  map<B>(map_fn: (val: T) => B): Parser<B> {
    return new PMap(this, map_fn);
  }

  pred(pred_fn: (val: T) => boolean): Parser<T> {
    return new Pred(this, pred_fn);
  }

  flat_map<B>(monad_fn: (val: T) => Parser<B>): Parser<B> {
    return new FlatMap(this, monad_fn);
  }

  inspect(): Parser<T> {
    return new Inspect(this);
  }
}

class Inspect<A> extends Parser<A> {
  parser: Parser<A>;

  parse(input: string): ParseResult<A> {
    const val = this.parser.parse(input);
    console.log(val);
    return val;
  }

  constructor(parser: Parser<A>) {
    super();
    this.parser = parser;
  }
}

class Pair<R1, R2> extends Parser<[R1, R2]> {
  parser1: Parser<R1>;
  parser2: Parser<R2>;

  parse(input: string): ParseResult<[R1, R2]> {
    let global_error;

    const {
      state,
      remainder: first_remainder,
      error,
      value: value1,
    } = this.parser1.parse(input);

    if (state == Result.Ok && value1 !== undefined) {
      const {
        state,
        remainder: second_remainder,
        error,
        value: value2,
      } = this.parser2.parse(first_remainder);

      if (state == Result.Ok && value2 !== undefined) {
        return {
          state: Result.Ok,
          remainder: second_remainder,
          value: [value1, value2],
        };
      } else {
        global_error = error;
      }
    } else {
      global_error = error;
    }

    return {
      state: Result.Error,
      error: global_error,
      remainder: input,
    };
    /*
    Proof of concept that monads (FlatMap) is the most fundamental parser
    combinator with map and pred (functor and filter) to create parser
    combinators

    let p: Parser<[R1, R2]> = this.parser1
      .flat_map(value1 => this.parser2
          .map(value2 => [value1, value2]))
    return p.parse(input)
    */
  }

  constructor(parser1: Parser<R1>, parser2: Parser<R2>) {
    super();
    this.parser1 = parser1;
    this.parser2 = parser2;
  }
}

class PMap<A, B> extends Parser<B> {
  parser: Parser<A>;
  map_fn: (val: A) => B;

  parse(input: string): ParseResult<B> {
    const {
      state,
      remainder,
      error,
      value,
    } = this.parser.parse(input);

    if (state == Result.Ok && value !== undefined) {
      return {
        state,
        remainder,
        value: this.map_fn(value),
      };
    }
    return {
      state,
      remainder,
      error,
    };
  }

  constructor(parser: Parser<A>, map_fn: (val: A) => B) {
    super();
    this.parser = parser;
    this.map_fn = map_fn;
  }
}

class Left<R1, R2> extends Parser<R1> {
  parser1: Parser<R1>;
  parser2: Parser<R2>;

  parse(input: string): ParseResult<R1> {
    return new PMap(
      new Pair(this.parser1, this.parser2),
      ([result1, _]) => result1,
    ).parse(input);
  }

  constructor(parser1: Parser<R1>, parser2: Parser<R2>) {
    super();
    this.parser1 = parser1;
    this.parser2 = parser2;
  }
}

class Right<R1, R2> extends Parser<R2> {
  parser1: Parser<R1>;
  parser2: Parser<R2>;

  parse(input: string): ParseResult<R2> {
    return new PMap(
      new Pair(this.parser1, this.parser2),
      ([_, result2]) => result2,
    ).parse(input);
  }

  constructor(parser1: Parser<R1>, parser2: Parser<R2>) {
    super();
    this.parser1 = parser1;
    this.parser2 = parser2;
  }
}

class ZeroOrMore<A> extends Parser<Array<A>> {
  parser: Parser<A>;

  parse(input: string): ParseResult<Array<A>> {
    const result: Array<A> = [];

    while (true) {
      const {
        state,
        remainder,
        value,
      } = this.parser.parse(input);

      if (state == Result.Ok && value !== undefined) {
        result.push(value);
        input = remainder;
      } else {
        break;
      }
    }

    return {
      state: Result.Ok,
      remainder: input,
      value: result,
    };
  }

  constructor(parser: Parser<A>) {
    super();
    this.parser = parser;
  }
}

class OneOrMore<A> extends Parser<Array<A>> {
  parser: Parser<A>;

  parse(input: string): ParseResult<Array<A>> {
    return new PMap(
      new Pair(this.parser, new ZeroOrMore(this.parser)),
      ([head, tail]) => {
        tail.unshift(head);
        return tail;
      },
    ).parse(input);
  }

  constructor(parser: Parser<A>) {
    super();
    this.parser = parser;
  }
}

class Pred<A> extends Parser<A> {
  parser: Parser<A>;
  pred_fn: (val: A) => boolean;

  parse(input: string): ParseResult<A> {
    const {
      state,
      remainder,
      value,
    } = this.parser.parse(input);

    if (state == Result.Ok && value !== undefined && this.pred_fn(value)) {
      return {
        state,
        remainder,
        value,
      };
    }

    return {
      state,
      remainder: input,
      error: "Failed predicate",
    };
  }

  constructor(parser: Parser<A>, pred_fn: (val: A) => boolean) {
    super();
    this.parser = parser;
    this.pred_fn = pred_fn;
  }
}

class Either extends Parser<unknown> {
  parsers: Array<Parser<unknown>>;

  parse(input: string): ParseResult<unknown> {
    for (const parser of this.parsers) {
      const {
        state,
        remainder,
        value,
      } = parser.parse(input);

      if (state == Result.Ok && value !== undefined) {
        return {
          state,
          remainder,
          value,
        };
      }
    }

    return {
      state: Result.Error,
      remainder: input,
      error: "No parser on the either succeed",
    };
  }

  constructor(...parsers: Array<Parser<unknown>>) {
    super();
    this.parsers = parsers;
  }
}

class FixedEither<T> extends Parser<T> {
  parsers: Array<Parser<T>>;

  parse(input: string): ParseResult<T> {
    for (const parser of this.parsers) {
      const {
        state,
        remainder,
        value,
      } = parser.parse(input);

      if (state == Result.Ok && value !== undefined) {
        return {
          state,
          remainder,
          value,
        };
      }
    }

    return {
      state: Result.Error,
      remainder: input,
      error: "No parser on the either succeed",
    };
  }

  constructor(...parsers: Array<Parser<T>>) {
    super();
    this.parsers = parsers;
  }
}

class FlatMap<A, B> extends Parser<B> {
  parser: Parser<A>;
  monad_fn: (val: A) => Parser<B>;

  parse(input: string): ParseResult<B> {
    const {
      state,
      remainder,
      error,
      value,
    } = this.parser.parse(input);

    if (state == Result.Ok && value !== undefined) {
      return this.monad_fn(value).parse(remainder);
    }

    return {
      state,
      remainder,
      error,
    };
  }

  constructor(parser: Parser<A>, monad_fn: (val: A) => Parser<B>) {
    super();
    this.parser = parser;
    this.monad_fn = monad_fn;
  }
}

class Optional<A> extends Parser<A | null> {
  parser: Parser<A>;

  parse(input: string): ParseResult<A | null> {
    const {
      remainder,
      value,
    } = this.parser.parse(input);

    return {
      state: Result.Ok,
      remainder,
      value: value || null,
    };
  }

  constructor(parser: Parser<A>) {
    super();
    this.parser = parser;
  }
}

class Sequence extends Parser<null> {
  parsers: Array<Parser<unknown>>;

  parse(input: string): ParseResult<null> {
    for (const parser of this.parsers) {
      const {
        state,
        remainder,
      } = parser.parse(input);

      input = remainder;

      if (state == Result.Error) {
        return {
          state,
          remainder: input,
          error: "Couldn't fulfill sequence of parsers",
        };
      }
    }

    return {
      state: Result.Ok,
      remainder: input,
      value: null,
    };
  }

  constructor(...parsers: Array<Parser<unknown>>) {
    super();
    this.parsers = parsers;
  }
}

export {
  FixedEither,
  Either,
  FlatMap,
  Inspect,
  Left,
  OneOrMore,
  Optional,
  Pair,
  PMap,
  Pred,
  Right,
  Sequence,
  ZeroOrMore,
};
