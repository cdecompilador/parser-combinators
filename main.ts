enum Result {
  Ok,
  Error
}

type ParseResult<T> = {
  state: Result
  remainder: string
  value?: T
  error?: string
}

abstract class Parser<T> {
  abstract parse(input: string): ParseResult<T>

  map<B>(map_fn: (val: T) => B): Parser<B> {
    return new PMap(this, map_fn)
  }

  pred(pred_fn: (val: T) => boolean): Parser<T> {
    return new Pred(this, pred_fn)
  }

  flat_map<B>(monad_fn: (val: T) => Parser<B>): Parser<B> {
    return new FlatMap(this, monad_fn)
  }

  inspect(): Parser<T> {
    return new Inspect(this)
  }
}

class Inspect<A> extends Parser<A> {
  parser: Parser<A>

  parse(input: string): ParseResult<A> {
    let val = this.parser.parse(input)
    console.log(val)
    return val
  }

  constructor(parser: Parser<A>) {
    super()
    this.parser = parser
  }
}

class Match extends Parser<string> {
  literal: string
  
  parse(input: string): ParseResult<string> {
    let next = input.slice(0, this.literal.length)
    let remainder = input.slice(this.literal.length)
    if (next === this.literal) {
      return {
        state: Result.Ok,
        remainder,
        value: this.literal
      }
    } else {
      return {
        state: Result.Error,
        remainder: input,
        error: "Couldn't match"
      }
    }
  }

  constructor(literal: string) {
    super()
    this.literal = literal
  }
}

class Item extends Parser<string> {
  parse(input: string): ParseResult<string> {
    if (input.length === 0) {
        return {
          state: Result.Error,
          remainder: input,
          error: "Couldn't retrieve a single item, EOI"
        }
    }

    return {
      state: Result.Ok,
      remainder: input.slice(1),
      value: input.charAt(0)
    }
  }
}

function isAlphabetic(ch: string): boolean {
  let n = ch.codePointAt(0);
  if (n == undefined) {
    return false;
  }
  return n >= 65 && n < 91 || n >= 97 && n < 123
}

function isNumeric(ch: string): boolean {
  return ch >= "0" && ch <= "9"
}

function isAlphanumeric(ch: string): boolean {
  return isAlphabetic(ch) || isNumeric(ch)
}

class Identifier extends Parser<string> {
  parse(input: string): ParseResult<string> {
    let c = 1

    if (!isAlphabetic(input[0])) {
      return {
        state: Result.Error,
        remainder: input,
        error: "Couldn't parse identifier"
      }
    }

    for (let i = 1; i < input.length; i++) {
      if (isAlphanumeric(input[i]) || input[i] == "-") {
        c++;
      } else {
        break;
      }
    }

    return {
      state: Result.Ok,
      value: input.slice(0, c),
      remainder: input.slice(c),
    }
  }
}

class Pair<R1, R2> extends Parser<[R1, R2]> {
  parser1: Parser<R1>
  parser2: Parser<R2>

  parse(input: string): ParseResult<[R1, R2]> {
    let global_error

    let {
      state,
      remainder: first_remainder,
      error,
      value: value1
    } = this.parser1.parse(input)

    if (state == Result.Ok && value1 !== undefined) {
        let {
          state,
          remainder: second_remainder,
          error,
          value: value2
        } = this.parser2.parse(first_remainder)

        if (state == Result.Ok && value2 !== undefined) {
          return {
            state: Result.Ok,
            remainder: second_remainder,
            value: [value1, value2]
          }
        } else {
          global_error = error
        }
    } else {
      global_error = error
    }

    return {
      state: Result.Error,
      error: global_error,
      remainder: input
    }

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
    super()
    this.parser1 = parser1
    this.parser2 = parser2
  }
}

class PMap<A, B> extends Parser<B> {
  parser: Parser<A>
  map_fn: (val: A) => B

  parse(input: string): ParseResult<B> {
    let {
      state,
      remainder,
      error,
      value
    } = this.parser.parse(input)

    if (state == Result.Ok && value !== undefined) {
      return {
        state,
        remainder,
        value: this.map_fn(value)
      }
    }
    return {
      state,
      remainder,
      error
    }
  }

  constructor(parser: Parser<A>, map_fn: (val: A) => B) {
    super()
    this.parser = parser
    this.map_fn = map_fn
  }
}

class Left<R1, R2> extends Parser<R1> {
  parser1: Parser<R1>
  parser2: Parser<R2>

  parse(input: string): ParseResult<R1> {
    return new PMap(
      new Pair(this.parser1, this.parser2),
      ([result1, result2]) => result1
    ).parse(input)
  }

  constructor(parser1: Parser<R1>, parser2: Parser<R2>) {
    super()
    this.parser1 = parser1
    this.parser2 = parser2
  }
}

class Right<R1, R2> extends Parser<R2> {
  parser1: Parser<R1>
  parser2: Parser<R2>

  parse(input: string): ParseResult<R2> {
    return new PMap(
      new Pair(this.parser1, this.parser2),
      ([result1, result2]) => result2
    ).parse(input)
  }

  constructor(parser1: Parser<R1>, parser2: Parser<R2>) {
    super()
    this.parser1 = parser1
    this.parser2 = parser2
  }
}

class ZeroOrMore<A> extends Parser<Array<A>> {
  parser: Parser<A>

  parse(input: string): ParseResult<Array<A>> {
    let result: Array<A> = []

    while (true) {
      let {
        state,
        remainder,
        value 
      } = this.parser.parse(input);

      if (state == Result.Ok && value !== undefined) {
        result.push(value)
        input = remainder
      } else {
        break;
      }
    }

    return {
      state: Result.Ok,
      remainder: input,
      value: result
    };
  }

  constructor(parser: Parser<A>) {
    super()
    this.parser = parser
  }
}

class OneOrMore<A> extends Parser<Array<A>> {
  parser: Parser<A>;

  parse(input: string): ParseResult<Array<A>> {
    return new PMap(
      new Pair(this.parser, new ZeroOrMore(this.parser)),
      ([head, tail]) => {
        tail.unshift(head)
        return tail
      }).parse(input)
  }

  constructor(parser: Parser<A>) {
    super()
    this.parser = parser
  }
}

class Pred<A> extends Parser<A> {
  parser: Parser<A>
  pred_fn: (val: A) => boolean

  parse(input: string): ParseResult<A> {
    let {
      state,
      remainder,
      error,
      value 
    } = this.parser.parse(input)

    if (state == Result.Ok && value !== undefined && this.pred_fn(value)) {
      return {
        state,
        remainder,
        value
      }
    }

    return {
      state,
      remainder: input,
      error: "Failed predicate"
    }
  }

  constructor(parser: Parser<A>, pred_fn: (val: A) => boolean) {
    super()
    this.parser = parser
    this.pred_fn = pred_fn
  }
}

class Either extends Parser<any> {
  parsers: Array<Parser<any>>

  parse(input: string): ParseResult<any> {
    for (const parser of this.parsers) {
      let {
        state,
        remainder,
        error,
        value 
      } = parser.parse(input);

      if (state == Result.Ok && value !== undefined) {
        return {
          state,
          remainder,
          value
        }
      }
    }
    
    return {
      state: Result.Error,
      remainder: input,
      error: "No parser on the either succeed"
    }
  }

  constructor(...parsers: Array<Parser<any>>) {
    super()
    this.parsers = parsers
  }
}

class FlatMap<A, B> extends Parser<B> {
  parser: Parser<A>
  monad_fn: (val: A) => Parser<B>

  parse(input: string): ParseResult<B> {
    let {
      state,
      remainder,
      error,
      value 
    } = this.parser.parse(input)

    if (state == Result.Ok && value !== undefined) {
      return this.monad_fn(value).parse(remainder)
    }

    return {
      state,
      remainder,
      error
    }
  }

  constructor(parser: Parser<A>, monad_fn: (val: A) => Parser<B>) {
    super()
    this.parser = parser
    this.monad_fn = monad_fn
  }
}

class Optional<A> extends Parser<A | null> {
  parser: Parser<A>

  parse(input: string): ParseResult<A | null> {
    let {
      state,
      remainder,
      value
    } = this.parser.parse(input);

    return {
      state: Result.Ok,
      remainder,
      value: value || null
    }
  }

  constructor(parser: Parser<A>) {
    super()
    this.parser = parser
  }
}

class Sequence extends Parser<null> {
  parsers: Array<Parser<any>>

  parse(input: string): ParseResult<null> {
    for (const parser of this.parsers) {
      let {
        state,
        remainder
      } = parser.parse(input)

      input = remainder

      if (state == Result.Error) {
        return {
          state,
          remainder: input,
          error: "Couldn't fulfill sequence of parsers"
        }
      }
    }

    return {
      state: Result.Ok,
      remainder: input,
      value: null,
    }
  }

  constructor(...parsers: Array<Parser<any>>) {
    super()
    this.parsers = parsers
  }
}

const WhiteSpace = new Item()
  .pred(ch => ch === " ")
  .map(_ => null)

const WhiteSpaces = new ZeroOrMore(WhiteSpace)

function SpaceSurrounded(match: string) {
  return new Sequence(WhiteSpaces, new Match(match), WhiteSpaces)
}

class JsonObject extends Parser<{}> {
  parse(input: string): ParseResult<{}> {
    const Num = new OneOrMore(new Item().pred(isNumeric))
      .map(value => parseInt(value.join("")))

    const QuotedString = new Either(new Match("\""), new Match("'"))
      .flat_map(delimiter =>
        new Left(
          new ZeroOrMore(new Item().pred(c => c != delimiter)),
          new Match(delimiter),
        )
      )
      .map(value => value.join(""))

    const Bool = new Either(new Match("true"), new Match("false"));

    class PArray extends Parser<any[]> {
      parse(input: string): ParseResult<any[]> {
        return new Right(
          SpaceSurrounded("["),
          new Left(
            new Optional(new Pair(
              new ZeroOrMore(
                new Left(
                  new Either(Num, Bool, QuotedString, this, new JsonObject),
                  SpaceSurrounded(",")
                )
              ),
              new Either(Num, Bool, QuotedString, this, new JsonObject())
            )
            .map(([elems, end_elem]) => {
              elems.push(end_elem)
              return elems
            })),
            SpaceSurrounded("]")
          )
        )
        .map(value => value || [])
        .parse(input)
      }
    }

    const JsonPair = new Pair(
      QuotedString,
      new Right(
        SpaceSurrounded(":"),
        new Either(Num, Bool, QuotedString, new PArray(), this).inspect()
      )
    )

    return new Right(
        SpaceSurrounded("{"),
        new Left(
          new Optional(new Pair(
            new ZeroOrMore(
              new Left(JsonPair, SpaceSurrounded(","))
            ),
            JsonPair
          ).map(([pairs, end_pair]) => {
            pairs.push(end_pair)
            return pairs
          }))
          .map(pairs => pairs || []),
          SpaceSurrounded("}")
        )
      )
    .map(pairs => {
      let jsonData = {};

      for (const [key, value] of pairs) {
        jsonData[key] = value;
      }

      return jsonData;
    })
    .parse(input)
  }
}

new Pair(new Match("Hello"), new Item()).map(_ => ":)").parse("Hello World")
/*
  Esto genera un:
  {
    state: Result.Ok,
    remainder: "World",
    value: [null, null]
  }
*/

new JsonObject().parse("{'hello': 'world'}")
/*
  Esto parsea json :D
*/