export type MathResult =
  | {
      success: true;
      value: number;
    }
  | {
      success: false;
      error: "Undefined" | "Invalid expression";
    };

type Token =
  | {
      type: "number";
      value: number;
    }
  | {
      type: "operator";
      value: "+" | "-" | "*" | "/";
    }
  | {
      type: "left-paren";
    }
  | {
      type: "right-paren";
    };

function normalizeExpression(
  expression: string
): string {
  let result = expression;

  result = result
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\times/g, "*")
    .replace(/\\cdot/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pm/g, "+")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");

  result = result.replace(/\s+/g, "");

  /*
   * A terminal '=' is allowed because
   * CalcInk recognizes '=' as part of
   * the expression.
   *
   * Example:
   *
   * "2+3="
   *
   * becomes:
   *
   * "2+3"
   */
  if (result.endsWith("=")) {
    result = result.slice(0, -1);
  }

  return result;
}

function tokenize(
  expression: string
): Token[] | null {
  const tokens: Token[] = [];

  let index = 0;

  while (
    index <
    expression.length
  ) {
    const character =
      expression[index];

    /*
     * Number
     *
     * Supports:
     *
     * 12
     * 12.5
     * .5
     */
    if (
      /[0-9.]/.test(
        character
      )
    ) {
      const start =
        index;

      let decimalCount =
        0;

      while (
        index <
        expression.length
      ) {
        const current =
          expression[index];

        if (current === ".") {
          decimalCount++;

          if (
            decimalCount > 1
          ) {
            return null;
          }

          index++;

          continue;
        }

        if (
          !/[0-9]/.test(
            current
          )
        ) {
          break;
        }

        index++;
      }

      const numberText =
        expression.slice(
          start,
          index
        );

      if (
        numberText === "." ||
        numberText === ""
      ) {
        return null;
      }

      const value =
        Number(numberText);

      if (
        !Number.isFinite(value)
      ) {
        return null;
      }

      tokens.push({
        type: "number",
        value,
      });

      continue;
    }

    /*
     * Operators
     */
    if (
      character === "+" ||
      character === "-" ||
      character === "*" ||
      character === "/"
    ) {
      tokens.push({
        type: "operator",
        value: character,
      });

      index++;

      continue;
    }

    /*
     * Parentheses
     *
     * They are not required by the PS
     * vocabulary, but supporting them makes
     * the parser safer and more complete.
     */
    if (character === "(") {
      tokens.push({
        type: "left-paren",
      });

      index++;

      continue;
    }

    if (character === ")") {
      tokens.push({
        type: "right-paren",
      });

      index++;

      continue;
    }

    /*
     * Anything else means the expression
     * contains a character we don't support.
     */
    return null;
  }

  return tokens;
}

class Parser {
  private tokens: Token[];

  private position = 0;

  constructor(
    tokens: Token[]
  ) {
    this.tokens = tokens;
  }

  private current(): Token | undefined {
    return this.tokens[
      this.position
    ];
  }

  private consume(): Token | undefined {
    const token =
      this.current();

    this.position++;

    return token;
  }

  /*
   * expression
   *
   * Handles:
   *
   * addition
   * subtraction
   *
   * Example:
   *
   * 2 + 3 - 1
   */
  parseExpression(): number {
    let value =
      this.parseTerm();

    while (true) {
      const token =
        this.current();

      if (
        token?.type !==
        "operator"
      ) {
        break;
      }

      if (
        token.value !== "+" &&
        token.value !== "-"
      ) {
        break;
      }

      this.consume();

      const right =
        this.parseTerm();

      if (
        token.value === "+"
      ) {
        value += right;
      } else {
        value -= right;
      }
    }

    return value;
  }

  /*
   * term
   *
   * Handles:
   *
   * multiplication
   * division
   *
   * This gives * and /
   * higher precedence than
   * + and -.
   */
  private parseTerm(): number {
    let value =
      this.parseUnary();

    while (true) {
      const token =
        this.current();

      if (
        token?.type !==
        "operator"
      ) {
        break;
      }

      if (
        token.value !== "*" &&
        token.value !== "/"
      ) {
        break;
      }

      this.consume();

      const right =
        this.parseUnary();

      if (
        token.value === "*"
      ) {
        value *= right;
      } else {
        if (right === 0) {
          throw new Error(
            "DIVISION_BY_ZERO"
          );
        }

        value /= right;
      }
    }

    return value;
  }

  /*
   * unary
   *
   * Handles negative numbers:
   *
   * -5
   * 2 * -3
   * -2 + 4
   */
  private parseUnary(): number {
    const token =
      this.current();

    if (
      token?.type ===
        "operator" &&
      token.value === "-"
    ) {
      this.consume();

      return -this.parseUnary();
    }

    if (
      token?.type ===
        "operator" &&
      token.value === "+"
    ) {
      this.consume();

      return this.parseUnary();
    }

    return this.parsePrimary();
  }

  /*
   * primary
   *
   * Handles numbers and parentheses.
   */
  private parsePrimary(): number {
    const token =
      this.consume();

    if (!token) {
      throw new Error(
        "INVALID_EXPRESSION"
      );
    }

    if (
      token.type ===
      "number"
    ) {
      return token.value;
    }

    if (
      token.type ===
      "left-paren"
    ) {
      const value =
        this.parseExpression();

      const closing =
        this.consume();

      if (
        closing?.type !==
        "right-paren"
      ) {
        throw new Error(
          "INVALID_EXPRESSION"
        );
      }

      return value;
    }

    throw new Error(
      "INVALID_EXPRESSION"
    );
  }

  isFinished(): boolean {
    return (
      this.position >=
      this.tokens.length
    );
  }
}

export function evaluateExpression(
  expression: string
): MathResult {
  try {
    const normalized =
      normalizeExpression(
        expression
      );

    if (
      normalized.length === 0
    ) {
      return {
        success: false,
        error: "Invalid expression",
      };
    }

    /*
     * An '=' anywhere except the
     * terminal position is invalid.
     */
    if (
      normalized.includes("=")
    ) {
      return {
        success: false,
        error: "Invalid expression",
      };
    }

    const tokens =
      tokenize(normalized);

    if (
      !tokens ||
      tokens.length === 0
    ) {
      return {
        success: false,
        error: "Invalid expression",
      };
    }

    const parser =
      new Parser(tokens);

    const value =
      parser.parseExpression();

    if (
      !parser.isFinished()
    ) {
      return {
        success: false,
        error: "Invalid expression",
      };
    }

    if (
      !Number.isFinite(value)
    ) {
      return {
        success: false,
        error: "Undefined",
      };
    }

    return {
      success: true,
      value,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "DIVISION_BY_ZERO"
    ) {
      return {
        success: false,
        error: "Undefined",
      };
    }

    return {
      success: false,
      error: "Invalid expression",
    };
  }
}