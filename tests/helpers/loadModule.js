const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const vm = require("node:vm");

const loadModule = (relativePath, mocks = {}, globals = {}) => {
    const filename = path.resolve(__dirname, "../..", relativePath);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    const parameters = ["require", "module", "exports", ...Object.keys(globals)].join(", ");
    const wrapper = vm.runInThisContext(
        `(function(${parameters}) {\n${readFileSync(filename, "utf8")}\n})`, { filename }
    );
    wrapper((name) => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name), module, module.exports, ...Object.values(globals));
    return module.exports;
};

module.exports = { loadModule };
