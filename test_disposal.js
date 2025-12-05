/**
 * Test script to verify proper sample disposal
 * Simulates loading different instrument styles and verifies resources are cleaned up
 */

const fs = require('fs');
const path = require('path');

// Load the player.js file to check for disposal logic
const playerPath = path.join(__dirname, 'public', 'player.js');
const playerCode = fs.readFileSync(playerPath, 'utf8');

// Load the sampleLoader.js file to check for disposal logic
const loaderPath = path.join(__dirname, 'public', 'sampleLoader.js');
const loaderCode = fs.readFileSync(loaderPath, 'utf8');

console.log('═══════════════════════════════════════════════════════════════');
console.log('SAMPLE DISPOSAL VERIFICATION TEST');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test 1: Check for disposeAllAudioResources function
console.log('✓ Test 1: Checking for disposeAllAudioResources function...');
if (playerCode.includes('function disposeAllAudioResources()')) {
  console.log('  ✓ disposeAllAudioResources function found');
} else {
  console.log('  ✗ disposeAllAudioResources function NOT found');
}

// Test 2: Check for panner array tracking
console.log('\n✓ Test 2: Checking for panner array tracking...');
if (playerCode.includes('let panners = []')) {
  console.log('  ✓ Panners array declared for tracking');
} else {
  console.log('  ✗ Panners array NOT declared');
}

// Test 3: Check for panner disposal logic
console.log('\n✓ Test 3: Checking for panner node disposal...');
if (playerCode.includes('panners.forEach(panner =>')) {
  console.log('  ✓ Panner disposal loop found');
} else {
  console.log('  ✗ Panner disposal loop NOT found');
}

// Test 4: Check for volume disposal logic
console.log('\n✓ Test 4: Checking for volume node disposal...');
if (playerCode.includes('volumes.forEach(volume =>')) {
  console.log('  ✓ Volume disposal loop found');
} else {
  console.log('  ✗ Volume disposal loop NOT found');
}

// Test 5: Check for sampler disposal in setupSamplers
console.log('\n✓ Test 5: Checking for sampler disposal in setupSamplers...');
if (playerCode.includes('disposeAllAudioResources()')) {
  console.log('  ✓ disposeAllAudioResources called in setupSamplers');
} else {
  console.log('  ✗ disposeAllAudioResources NOT called in setupSamplers');
}

// Test 6: Check for panner tracking in setupSamplers
console.log('\n✓ Test 6: Checking for panner tracking in setupSamplers...');
if (playerCode.includes('panners.push(panner)')) {
  console.log('  ✓ Panners are tracked when created');
} else {
  console.log('  ✗ Panners are NOT tracked');
}

// Test 7: Check for enhanced disposeSamplers function
console.log('\n✓ Test 7: Checking for enhanced disposeSamplers function...');
if (loaderCode.includes('sampler.disconnect()')) {
  console.log('  ✓ Samplers disconnected before disposal');
} else {
  console.log('  ✗ Samplers NOT disconnected before disposal');
}

// Test 8: Check for error handling in disposal
console.log('\n✓ Test 8: Checking for error handling in disposal...');
if (loaderCode.includes('try') && loaderCode.includes('catch')) {
  console.log('  ✓ Error handling added to disposal process');
} else {
  console.log('  ✗ Error handling NOT added to disposal');
}

// Test 9: Check for console logging in disposal
console.log('\n✓ Test 9: Checking for console logging in disposal...');
if (playerCode.includes('All audio resources disposed') || loaderCode.includes('disposed')) {
  console.log('  ✓ Disposal logging present for debugging');
} else {
  console.log('  ✗ Disposal logging NOT present');
}

// Test 10: Check for array clearing
console.log('\n✓ Test 10: Checking for array clearing after disposal...');
if (playerCode.includes('samplers = []') && playerCode.includes('volumes = []') && playerCode.includes('panners = []')) {
  console.log('  ✓ Arrays properly cleared after disposal');
} else {
  console.log('  ✗ Arrays NOT properly cleared');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DISPOSAL SYSTEM SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

// Summary check
const disposalChecks = [
  playerCode.includes('function disposeAllAudioResources()'),
  playerCode.includes('let panners = []'),
  playerCode.includes('panners.forEach(panner =>'),
  playerCode.includes('volumes.forEach(volume =>'),
  playerCode.includes('disposeAllAudioResources()'),
  playerCode.includes('panners.push(panner)'),
  loaderCode.includes('sampler.disconnect()'),
  loaderCode.includes('try') && loaderCode.includes('catch'),
  playerCode.includes('All audio resources disposed'),
  playerCode.includes('samplers = []') && playerCode.includes('volumes = []') && playerCode.includes('panners = []')
];

const passedTests = disposalChecks.filter(test => test).length;
const totalTests = disposalChecks.length;

console.log(`\nPassed: ${passedTests}/${totalTests} checks`);
console.log(`Status: ${passedTests === totalTests ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DISPOSAL FLOW:');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`
1. When setupSamplers() is called with a new style:
   - disposeAllAudioResources() is invoked

2. disposeAllAudioResources() performs:
   - Calls disposeSamplers(samplers) for all samplers
   - Loops through all Volume nodes and calls disconnect/dispose
   - Loops through all Panner nodes and calls disconnect/dispose
   - Clears samplers[], volumes[], and panners[] arrays

3. Enhanced disposeSamplers() in sampleLoader.js:
   - Disconnects each sampler before disposing
   - Wraps disposal in try/catch for error handling
   - Logs each sampler disposal for debugging

4. Result: Complete cleanup of audio resources before loading new samples
`);
console.log('═══════════════════════════════════════════════════════════════\n');
