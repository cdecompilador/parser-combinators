import {
  ParseResult,
  Parser,
  Either,
  Left,
  OneOrMore,
  Optional,
  Pair,
  Right,
  Sequence,
  ZeroOrMore,
} from "./combinators.ts";
import { isNumeric, Item, Match } from "./simple.ts";

const WhiteSpace = new Item()
  .pred((ch) => ch === " ")
  .map((_) => null);

const WhiteSpaces = new ZeroOrMore(WhiteSpace);

function SpaceSurrounded(match: string) {
  return new Sequence(WhiteSpaces, new Match(match), WhiteSpaces);
}

class JsonObject extends Parser<Record<string, unknown>> {
  parse(input: string): ParseResult<Record<string, unknown>> {
    const Num = new OneOrMore(new Item().pred(isNumeric))
      .map((value) => parseInt(value.join("")));

    const QuotedString = new Either(new Match('"'), new Match("'"))
      .flat_map((delimiter) =>
        new Left(
          new ZeroOrMore(new Item().pred((c) => c != delimiter)),
          new Match(delimiter as string),
        )
      )
      .map((value) => value.join(""));

    const Bool = new Either(new Match("true"), new Match("false"));

    class PArray extends Parser<unknown[]> {
      parse(input: string): ParseResult<unknown[]> {
        return new Right(
          SpaceSurrounded("["),
          new Left(
            new Optional(new Pair(
              new ZeroOrMore(
                new Left(
                  new Either(Num, Bool, QuotedString, this, new JsonObject()),
                  SpaceSurrounded(","),
                ),
              ),
              new Either(Num, Bool, QuotedString, this, new JsonObject()),
            )
              .map(([elems, end_elem]) => {
                elems.push(end_elem);
                return elems;
              })),
            SpaceSurrounded("]"),
          ),
        )
          .map((value) => value || [])
          .parse(input);
      }
    }

    const JsonPair = new Pair(
      QuotedString,
      new Right(
        SpaceSurrounded(":"),
        new Either(Num, Bool, QuotedString, new PArray(), this).inspect(),
      ),
    );

    return new Right(
      SpaceSurrounded("{"),
      new Left(
        new Optional(new Pair(
          new ZeroOrMore(
            new Left(JsonPair, SpaceSurrounded(",")),
          ),
          JsonPair,
        ).map(([pairs, end_pair]) => {
          pairs.push(end_pair);
          return pairs;
        }))
          .map((pairs) => pairs || []),
        SpaceSurrounded("}"),
      ),
    )
      .map((pairs) => {
        const jsonData: Record<string, unknown> = {};

        for (const [key, value] of pairs) {
          jsonData[key] = value;
        }

        return jsonData;
      })
      .parse(input);
  }
}

export { JsonObject }
