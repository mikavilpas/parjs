import path from "path";
import { Config } from "jest";

const config: Config = {
    // this is toggled on in the CI, but is off by default because it's
    // distracting and a bit slower
    collectCoverage: false,
    setupFilesAfterEnv: [path.join(__dirname, "src", "test", "helpers", "jest-setup.ts")],
    testPathIgnorePatterns: ["dist"],
    transform: {
        // @swc-jest is used because the default ts-jest transformer can be slow
        "^.+\\.(t|j)sx?$": "@swc/jest"
    }
};

export default config;
