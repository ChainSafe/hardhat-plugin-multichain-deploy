// fix strange issue with yarn workspaces when mocha try to access ts-node from root `node_modules`
var tsNode = require.resolve('./test/compiler.js');

module.exports = {
    "require": tsNode,
    "ignore": ["test/fixture-projects/**/*"],
    "timeout": 6000
};
