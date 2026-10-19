import assert from 'node:assert/strict';
import { compareDose } from '../src/health/learning.js';
assert.equal(compareDose('100 mg','10 mg',true).status,'flag');
assert.equal(compareDose('10 mg','10 mg',true).status,'match');
assert.equal(compareDose('','10 mg',true).status,'unknown');
assert.equal(compareDose('0.01 g','10 mg',true).status,'unknown');
assert.equal(compareDose('100 mg','10 mg',false).status,'blocked');
assert.equal(compareDose('10 mg twice daily','10 mg',true).status,'unknown');
console.log('PASS: approved source-comparison rule and unsupported input handling');
