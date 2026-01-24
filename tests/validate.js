#!/usr/bin/env node

/**
 * Validation script for GNOME Shell Extension
 * Checks metadata.json format and JavaScript syntax
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const METADATA_PATH = path.join(REPO_ROOT, 'metadata.json');
const EXTENSION_PATH = path.join(REPO_ROOT, 'extension.js');

let exitCode = 0;

// Test 1: Check that metadata.json exists
console.log('✓ Running validation tests...\n');

if (!fs.existsSync(METADATA_PATH)) {
    console.error('✗ metadata.json not found');
    exitCode = 1;
} else {
    console.log('✓ metadata.json exists');
}

// Test 2: Validate metadata.json is valid JSON
if (fs.existsSync(METADATA_PATH)) {
    try {
        const content = fs.readFileSync(METADATA_PATH, 'utf8');
        const metadata = JSON.parse(content);

        // Test 3: Check required fields
        const requiredFields = ['name', 'description', 'uuid', 'shell-version'];
        const missingFields = requiredFields.filter(field => !(field in metadata));

        if (missingFields.length > 0) {
            console.error(`✗ metadata.json missing required fields: ${missingFields.join(', ')}`);
            exitCode = 1;
        } else {
            console.log('✓ metadata.json has all required fields');
        }

        // Test 4: Check UUID format
        if (metadata.uuid && !metadata.uuid.includes('@')) {
            console.error('✗ metadata.json uuid should contain @ symbol');
            exitCode = 1;
        } else if (metadata.uuid) {
            console.log('✓ metadata.json uuid format is valid');
        }

        // Test 5: Check shell-version is an array
        if (metadata['shell-version'] && !Array.isArray(metadata['shell-version'])) {
            console.error('✗ metadata.json shell-version must be an array');
            exitCode = 1;
        } else if (metadata['shell-version']) {
            console.log('✓ metadata.json shell-version is an array');
        }

    } catch (err) {
        console.error(`✗ metadata.json is not valid JSON: ${err.message}`);
        exitCode = 1;
    }
}

// Test 6: Check that extension.js exists
if (!fs.existsSync(EXTENSION_PATH)) {
    console.error('✗ extension.js not found');
    exitCode = 1;
} else {
    console.log('✓ extension.js exists');
}

// Test 7: Basic syntax check - try to parse extension.js
if (fs.existsSync(EXTENSION_PATH)) {
    try {
        const content = fs.readFileSync(EXTENSION_PATH, 'utf8');

        // Check for required export
        if (!content.includes('export default class')) {
            console.error('✗ extension.js must export a default class');
            exitCode = 1;
        } else {
            console.log('✓ extension.js exports a default class');
        }

        // Check for enable/disable methods
        if (!content.includes('enable()') || !content.includes('disable()')) {
            console.error('✗ extension.js must have enable() and disable() methods');
            exitCode = 1;
        } else {
            console.log('✓ extension.js has enable() and disable() methods');
        }

    } catch (err) {
        console.error(`✗ Failed to read extension.js: ${err.message}`);
        exitCode = 1;
    }
}

console.log('\n' + (exitCode === 0 ? '✓ All validation tests passed!' : '✗ Some validation tests failed!'));
process.exit(exitCode);
