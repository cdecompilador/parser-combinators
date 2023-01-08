import {
  FixedEither,
  Either,
  Left,
  OneOrMore,
  Optional,
  Pair,
  Parser,
  ParseResult,
  Right,
  Sequence,
  ZeroOrMore,
} from "./combinators.ts";
import { isNumeric, Item, Match, Identifier } from "./simple.ts";

/// Helper parser combinators

const WhiteSpace = new Item()
  .pred((ch) => ch === " ")
  .map((_) => null)

const WhiteSpaces = new ZeroOrMore(WhiteSpace);

class BinaryOp<T, O> extends Parser<[T, O, T]> {
  operand: Parser<T>
  op: Parser<O>
  
  parse(input: string): ParseResult<[T, O, T]> {
    return new Pair(
      this.operand,
      new Pair(
        this.op,
        this.operand
      )
    )
    .map(([a, [b, c]]: [T, [O, T]]) => [a, b, c] as [T, O, T])
    .parse(input)
  }  
  
  constructor(operand: Parser<T>, op: Parser<O>) {
    super()
    this.operand = operand
    this.op = op
  }
}

class Surrounded<T> extends Parser<T> {
  left: Parser<any>
  right: Parser<any>
  middle: Parser<T>
  parse(input: string): ParseResult<T> {
    return new Right(this.left, new Left(this.middle, this.right)).parse(input)
  }
  
  constructor(left: Parser<any>, middle: Parser<T>, right?: Parser<any>) {
    super()
    this.left = left
    this.middle = middle
    if (right) {
      this.right = right
    } else {
      this.right = left
    }
  }
}

class SpaceSurrounded<T> extends Parser<T> {
  parser: Parser<T>
  
  parse(input: string): ParseResult<T> {
    return new Surrounded(WhiteSpaces, this.parser).parse(input)
  }

  constructor(parser: Parser<T>) {
    super()
    this.parser = parser
  }
}

/// Syntax tree parser combinators

const IntLiteral = new OneOrMore(new Item().pred(isNumeric))
  .map((value) => new LiteralExpr(parseInt(value.join(""))))

class Factor extends Parser<Expr> {
  parse(input: string): ParseResult<Expr> {
    return new SpaceSurrounded(new FixedEither(
      new Identifier()
        .map((ident: string) => new IdentExpr(ident)),
      IntLiteral,
      new Surrounded(
        new Match("("),
        new ExprParser(),
        new Match(")")
      )
    ))
    .parse(input)
  }
}

class Term extends Parser<Expr> {
  parse(input: string): ParseResult<Expr> {
    return new Pair(
      new Factor(),
      new ZeroOrMore(
        new Pair(
          new FixedEither(new Match("*"), new Match("/")),
          new Factor()
        )
      )
    )
    // Transform the Term parse result to a syntax tree
    .map(([factor, right]) => {
      // Check if there are right elements
      if (right.length == 0) {
        return factor;
      }
   
      // There is at least 1 right element, create the base bin_op_expr
      let it = right[Symbol.iterator]();
      let [op, left_expr] = it.next().value;
      let bin_op_expr = new BinOpExpr(factor, op, left_expr);
        
      // With the remaining [op, left_expr] element create the syntax tree from
      // bottom to top
      let res = it.next();
      while (!res.done) {
        let [op, left_expr] = res.value;
        bin_op_expr = new BinOpExpr(bin_op_expr, op, left_expr);
          
        res = it.next();
      }
        
      return bin_op_expr;
    })
    .parse(input)
  }
}

class ExprParser extends Parser<Expr> {
  parse(input: string): ParseResult<Expr> {
    return new Pair(
      new Pair(
        new Optional(new FixedEither(
          new Match("+"),
          new Match("-")
        )),
        new Term()
      )
      .map(([unary_op, term]) => {
        // Build unary expression in case there is a unary operator
        if (unary_op) {
          return new UnaryOpExpr(unary_op, term)
        }
        
        return term
      }),
      new ZeroOrMore(
        new Pair(
          new FixedEither(new Match("+"), new Match("-")),
          new Term()
        )
      )
    )
    .map(([term, right]) => {
      // Check if there is any right elements
      if (right.length == 0) {
          return term
      }
        
      // There is at least 1 right element, create the base bin_op_expr
      let it = right[Symbol.iterator]()
      let [op, left_expr] = it.next().value;
      let bin_op_expr = new BinOpExpr(term, op, left_expr)      
      // With the remaining [op, left_expr] element create the syntax tree from
      // bottom to top
      let res = it.next()
      while (!res.done) {
        let [op, left_expr] = res.value;
        bin_op_expr = new BinOpExpr(bin_op_expr, op, left_expr)
        
        res = it.next()
      }

      return bin_op_expr
    })
    .parse(input)
  }
}

class ConditionParser extends Parser<Condition> {
  parse(input: string): ParseResult<Condition> {
    return new FixedEither(
      new Pair(
        new Match("odd"),
        new ExprParser()       
      )
      .map(([op, expr]) => {
        return new UnaryCondition(op, expr) as Condition
      }),
      new BinaryOp(
        new ExprParser(),
        new FixedEither(
          new Match("="),
          new Match("#"),
          new Match("<"),
          new Match("<="),
          new Match(">"),
          new Match(">=")
        )
      )
      .map(([left_expr, op, right_expr]) => {
        return new BinCondition(left_expr, op, right_expr) as Condition
      })      
    )
    .parse(input)
  }
}

class StmtParser extends Parser<Stmt> {
  parse(input: string): ParseResult<Stmt> {
    return new Pair(
      new Identifier(),
      new Right(
        new SpaceSurrounded(new Match(":=")),
        new ExprParser()
      )
    )
    .map(([id, expr]) => {
      return new VarAssignStmt(id, expr)
    })
    .parse(input)
  }
}

/// AST definitions

abstract class Expr {}

class LiteralExpr extends Expr {
  literal: number;

  constructor(literal: number) {
    super();
    this.literal = literal;
  }
}

class IdentExpr extends Expr {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }
}

class BinOpExpr extends Expr {
  left: Expr
  op: string
  right: Expr
  
  constructor(left: Expr, op: string, right: Expr) {
    super()
    this.left = left
    this.op = op
    this.right = right
  }
 }

class UnaryOpExpr extends Expr {
  op: string
  e: Expr
  
  constructor(op: string, e: Expr) {
    super()
    this.op = op
    this.e = e
  }
}

abstract class Condition {}

class UnaryCondition extends Condition {
  op: string
  expr: Expr
  
  constructor(op: string, expr: Expr) {
    super()
    this.op = op
    this.expr = expr
  }
}

class BinCondition extends Condition {
  left: Expr
  op: string
  right: Expr
  
  constructor(left: Expr, op: string, right: Expr) {
    super()
    this.left = left
    this.op = op
    this.right = right
  }
}

abstract class Stmt {}

class VarAssignStmt extends Stmt {
  id: string
  value: Expr
  
  constructor(id: string, value: Expr) {
    super()
    this.id = id
    this.value = value
  }  
}