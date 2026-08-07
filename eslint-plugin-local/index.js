"use strict";

const noJsImportResolvingToDts = require("./rules/no-js-import-resolving-to-dts");

module.exports = {
  rules: {
    "no-js-import-resolving-to-dts": noJsImportResolvingToDts,
  },
};
