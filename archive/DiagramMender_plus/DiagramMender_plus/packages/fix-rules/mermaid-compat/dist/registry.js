"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.list = list;
const rules = [];
function register(rule) { rules.push(rule); }
function list() { return rules.sort((a, b) => a.priority - b.priority); }
