var tsConfig = require.resolve("./tsconfig.json");
console.log("./test/tsconfig.json", tsConfig)
require("ts-node").register({
    project: tsConfig,
});
