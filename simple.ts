import { Parser, ParseResult, Result } from "./combinators.ts";

class Match extends Parser<string> {
  literal: string;

  parse(input: string): ParseResult<string> {
    const next = input.slice(0, this.literal.length),
          remainder = input.slice(this.literal.length);
    if (next === this.literal) {
      return {
        state: Result.Ok,
        remainder,
        value: this.literal,
      };
    } else {
      return {
        state: Result.Error,
        remainder: input,
        error: "Couldn't match",
      };
    }
  }

  constructor(literal: string) {
    super();
    this.literal = literal;
  }
}

class Item extends Parser<string> {
  parse(input: string): ParseResult<string> {
    if (input.length === 0) {
      return {
        state: Result.Error,
        remainder: input,
        error: "Couldn't retrieve a single item, EOI",
      };
    }

    return {
      state: Result.Ok,
      remainder: input.slice(1),
      value: input.charAt(0),
    };
  }
}

function isAlphabetic(ch: string): boolean {
  if (ch === undefined) {
    return false;
  }
  const n = ch.codePointAt(0);
  if (n === undefined) {
    return false;
  }
  return n >= 65 && n < 91 || n >= 97 && n < 123;
}

function isNumeric(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isAlphanumeric(ch: string): boolean {
  return isAlphabetic(ch) || isNumeric(ch);
}

class Identifier extends Parser<string> {
  parse(input: string): ParseResult<string> {
    let c = 1;

    if (!isAlphabetic(input[0])) {
      return {
        state: Result.Error,
        remainder: input,
        error: "Couldn't parse identifier",
      };
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
    };
  }
}

export { Identifier, isAlphabetic, isAlphanumeric, isNumeric, Item, Match };
