import assert from 'node:assert/strict';
import {canonicalLookup} from './reconciliation-normalization.mjs';
assert.equal(canonicalLookup('Сок клена'),'Сок клёна');
assert.equal(canonicalLookup('Никелиевая руда'),'Никелевая руда');
assert.equal(canonicalLookup('Анакреон '),'Анакреон');
assert.equal(canonicalLookup('Неизвестная опечатка'),'Неизвестная опечатка');
console.log('PASS');
