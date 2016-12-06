import { ParjsAction } from "../../../base/action";
/**
 * Created by lifeg on 24/11/2016.
 */
export declare class PrsQuiet extends ParjsAction {
    private inner;
    displayName: string;
    isLoud: boolean;
    expecting: string;
    constructor(inner: AnyParserAction);
    _apply(ps: ParsingState): void;
}
