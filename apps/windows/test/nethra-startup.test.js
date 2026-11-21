'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startupScriptPath } = require('../src/nethra-startup');

test('packaged startup resolves its PowerShell script from unpacked resources', () => {
  assert.equal(startupScriptPath({
    packaged: true,
    resourcesPath: 'C:\\Nethra\\resources',
    sourceDirectory: 'C:\\Nethra\\resources\\app.asar\\src',
  }), path.join('C:\\Nethra\\resources', 'nethra-startup.ps1'));
});

test('development startup resolves its PowerShell script beside its source module', () => {
  assert.equal(startupScriptPath({
    packaged: false,
    resourcesPath: 'C:\\Nethra\\resources',
    sourceDirectory: 'C:\\Nethra\\src',
  }), path.join('C:\\Nethra\\src', 'nethra-startup.ps1'));
});
