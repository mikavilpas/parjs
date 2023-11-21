/**
 * @module parjs/internal
 */
/** */

import {
    ParjsFailure,
    ParjsResult,
    ResultKind,
    ParjsSuccess,
    Trace,
    ErrorLocation
} from "./result";
import {
    BasicParsingState,
    FAIL_RESULT,
    ParsingState,
    UNINITIALIZED_RESULT,
    UserState
} from "./state";
import defaults from "lodash/defaults";
import { ParserDefinitionError } from "../errors";
import { ParjsCombinator, Parjser } from "./parjser";
import { pipe } from "./combinators/combinator";
import clone from "lodash/clone";
import { ScalarConverter } from ".";

function getErrorLocation(ps: ParsingState) {
    const endln = /\r\n|\n|\r/g;
    const { position } = ps;
    let lastPos = 0;
    let result: RegExpMatchArray | null;
    let line = 0;

    while ((result = endln.exec(ps.input))) {
        if (result.index! > position) break;
        lastPos = result.index! + result[0].length;
        line++;
    }
    return {
        line,
        column: line === 0 ? position : position - lastPos
    } as ErrorLocation;
}

/**
 * A marker class used for storing the parser's user state.
 */
export class ParserUserState implements UserState {
    [key: string]: unknown;
}

/**
 * The internal base Parjs parser class, which supports only basic parsing
 * operations. Should not be used in user code.
 */
export abstract class ParjserBase<TValue> implements Parjser<TValue> {
    abstract type: string;
    abstract expecting: string;

    expects(expecting: string): Parjser<TValue> {
        const copy = clone(this);
        copy.expecting = expecting;
        return copy as Parjser<TValue>;
    }
    /**
     * Apply the parser to the given state.
     * @param ps The parsing state.
     */
    apply(ps: ParsingState): void {
        // @ts-expect-error Check for uninitialized kind.
        ps.kind = "Unknown";
        ps.reason = undefined;
        ps.value = UNINITIALIZED_RESULT;
        this._apply(ps);
        // @ts-expect-error Check for uninitialized kind.
        if (ps.kind === "Unknown") {
            throw new ParserDefinitionError(
                this.type,
                "the parser's result kind field has not been set."
            );
        }
        if (!ps.isOk) {
            ps.value = FAIL_RESULT;
            ps.reason = ps.reason || this.expecting;
        } else if (ps.value === UNINITIALIZED_RESULT) {
            throw new ParserDefinitionError(
                this.type,
                "a parser must set the result's value field if it succeeds."
            );
        }

        if (!ps.isOk) {
            if (ps.reason == null) {
                throw new ParserDefinitionError(this.type, "a failure must have a reason");
            }
            ps.stack.push(this as Parjser<unknown>);
        } else {
            ps.stack = [];
        }
    }

    /**
     * The internal operation performed by the PARSER. This will be overriden by derived classes.
     * @param ps
     * @private
     */
    abstract _apply(ps: ParsingState): void;

    parse(input: string, initialState?: UserState): ParjsResult<TValue> {
        if (typeof input !== "string") {
            // catches input === undefined, null
            throw new TypeError("input must be a valid string");
        }
        const ps = new BasicParsingState<TValue>(
            input,
            defaults(new ParserUserState(), initialState)
        );
        ps.initialUserState = initialState;
        this.apply(ps);

        if (ps.isOk) {
            if (ps.position !== input.length) {
                ps.kind = ResultKind.SoftFail;
                ps.reason = "parsers did not consume all input";
            }
        }
        // @ts-expect-error Check for uninitialized kind.
        if (ps.kind === "Unknown") {
            throw new Error("Kind was Unknown after parsing finished. This is a bug.");
        }
        if (ps.kind === ResultKind.Ok) {
            return new ParjsSuccess(ps.value!);
        } else {
            const trace: Trace = {
                userState: ps.userState,
                position: ps.position,
                reason: ps.reason,
                input,
                get location() {
                    return getErrorLocation(ps);
                },
                stackTrace: ps.stack,
                kind: ps.kind
            };

            return new ParjsFailure(trace);
        }
    }

    // eslint-disable-next-line max-params
    pipe<T, T1, T2 = T1, T3 = T2, T4 = T3, T5 = T4, T6 = T5>(
        cmb1?: ParjsCombinator<T, T1>,
        cmb2?: ParjsCombinator<T1, T2>,
        cmb3?: ParjsCombinator<T2, T3>,
        cmb4?: ParjsCombinator<T3, T4>,
        cmb5?: ParjsCombinator<T4, T5>,
        cmb6?: ParjsCombinator<T5, T6>
    ): Parjser<T6> {
        const combinators = [cmb1, cmb2, cmb3, cmb4, cmb5, cmb6].filter(x => x != null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let last: any = ScalarConverter.convert(this);

        for (const cmb of combinators) {
            last = pipe(last, cmb as ParjsCombinator<unknown, unknown>);
        }

        return last as unknown as Parjser<T6>;
    }
}
