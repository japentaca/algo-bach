/**
 * MIDI Module for Bach Generator
 * Handles Web MIDI API communication for sending notes to external MIDI devices
 */

// Global MIDI state
let midiAccess = null;
let selectedOutput = null;
let midiEnabled = false;

// Voice configuration (Soprano, Alto, Tenor, Bass)
const voiceConfig = [
  { channel: 1, volume: 100, pan: 63, name: "Soprano" },
  { channel: 2, volume: 100, pan: 42, name: "Alto" },
  { channel: 3, volume: 100, pan: 21, name: "Tenor" },
  { channel: 4, volume: 100, pan: 0, name: "Bass" }
];

/**
 * Initialize MIDI system
 * @returns {Promise<boolean>} True if MIDI is available and initialized
 */
async function initMidi() {
  try {
    // Check if Web MIDI API is supported
    if (!navigator.requestMIDIAccess) {
      console.warn("Web MIDI API is not supported in this browser");
      return false;
    }

    // Request MIDI access
    midiAccess = await navigator.requestMIDIAccess();

    // Set up event listeners for device changes
    midiAccess.onstatechange = updateDeviceList;

    console.log("MIDI initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize MIDI:", error);
    return false;
  }
}

/**
 * Get list of available MIDI output devices
 * @returns {Array<{id: string, name: string}>} Array of output devices
 */
function getOutputDevices() {
  if (!midiAccess) return [];

  const devices = [];
  for (const output of midiAccess.outputs.values()) {
    devices.push({
      id: output.id,
      name: output.name || `MIDI Device ${output.id}`
    });
  }

  return devices;
}

/**
 * Select MIDI output device
 * @param {string} deviceId - ID of the device to select
 * @returns {boolean} True if device was selected successfully
 */
function selectOutputDevice(deviceId) {
  if (!midiAccess) return false;

  selectedOutput = midiAccess.outputs.get(deviceId);
  if (selectedOutput) {
    console.log(`Selected MIDI output: ${selectedOutput.name}`);
    return true;
  }

  console.error(`MIDI output device not found: ${deviceId}`);
  return false;
}

/**
 * Enable/disable MIDI output
 * @param {boolean} enabled - Whether to enable MIDI output
 */
function setMidiEnabled(enabled) {
  midiEnabled = enabled && selectedOutput !== null;
  console.log(`MIDI output ${midiEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Send MIDI message
 * @param {Array<number>} message - MIDI message bytes
 */
function sendMidiMessage(message) {
  if (!midiEnabled || !selectedOutput) return;

  try {
    selectedOutput.send(message);
  } catch (error) {
    console.error("Error sending MIDI message:", error);
  }
}

/**
 * Convert pitch notation to MIDI note number
 * @param {string} pitch - Pitch notation (e.g., "C4", "F#3")
 * @returns {number} MIDI note number (0-127)
 */
function pitchToMidiNote(pitch) {
  if (!pitch || pitch.length < 2) return 60; // Default to middle C

  const noteNames = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  const note = pitch.substring(0, pitch.length - 1);
  const octave = parseInt(pitch[pitch.length - 1]);

  const noteNumber = noteNames[note];
  if (noteNumber === undefined) return 60; // Default to middle C

  return noteNumber + (octave + 1) * 12;
}

/**
 * Send note_on message
 * @param {string} pitch - Pitch notation (e.g., "C4")
 * @param {number} velocity - Note velocity (0-127)
 * @param {number} voiceIndex - Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
 */
function noteOn(pitch, velocity = 100, voiceIndex = 0) {
  if (!midiEnabled || !selectedOutput || voiceIndex < 0 || voiceIndex >= 4) return;

  const midiNote = pitchToMidiNote(pitch);
  const channel = voiceConfig[voiceIndex].channel - 1; // MIDI channels are 0-15

  // Note on message: [0x90 + channel, note, velocity]
  sendMidiMessage([0x90 + channel, midiNote, velocity]);
}

/**
 * Send note_off message
 * @param {string} pitch - Pitch notation (e.g., "C4")
 * @param {number} voiceIndex - Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
 */
function noteOff(pitch, voiceIndex = 0) {
  if (!midiEnabled || !selectedOutput || voiceIndex < 0 || voiceIndex >= 4) return;

  const midiNote = pitchToMidiNote(pitch);
  const channel = voiceConfig[voiceIndex].channel - 1; // MIDI channels are 0-15

  // Note off message: [0x80 + channel, note, velocity]
  sendMidiMessage([0x80 + channel, midiNote, 0]);
}

/**
 * Set voice volume
 * @param {number} voiceIndex - Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
 * @param {number} volume - Volume value (0-127)
 */
function setVoiceVolume(voiceIndex, volume) {
  if (voiceIndex < 0 || voiceIndex >= 4) return;

  // Clamp volume to valid range
  volume = Math.max(0, Math.min(127, volume));
  voiceConfig[voiceIndex].volume = volume;

  if (!midiEnabled || !selectedOutput) return;

  const channel = voiceConfig[voiceIndex].channel - 1;

  // Control change message for volume (CC 7): [0xB0 + channel, 7, volume]
  sendMidiMessage([0xB0 + channel, 7, volume]);
}

/**
 * Set voice pan position
 * @param {number} voiceIndex - Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
 * @param {number} pan - Pan value (0-127, where 0=left, 64=center, 127=right)
 */
function setVoicePan(voiceIndex, pan) {
  if (voiceIndex < 0 || voiceIndex >= 4) return;

  // Clamp pan to valid range
  pan = Math.max(0, Math.min(127, pan));
  voiceConfig[voiceIndex].pan = pan;

  if (!midiEnabled || !selectedOutput) return;

  const channel = voiceConfig[voiceIndex].channel - 1;

  // Control change message for pan (CC 10): [0xB0 + channel, 10, pan]
  sendMidiMessage([0xB0 + channel, 10, pan]);
}

/**
 * Set voice MIDI channel
 * @param {number} voiceIndex - Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
 * @param {number} channel - MIDI channel (1-16)
 */
function setVoiceChannel(voiceIndex, channel) {
  if (voiceIndex < 0 || voiceIndex >= 4) return;

  // Clamp channel to valid range
  channel = Math.max(1, Math.min(16, channel));
  voiceConfig[voiceIndex].channel = channel;
}

/**
 * Auto-pan voices across stereo field based on voice count
 * @param {number} voiceCount - Number of voices to pan (1-4)
 */
function autoPanVoices(voiceCount = 4) {
  if (voiceCount < 1 || voiceCount > 4) return;

  // Calculate pan positions based on voice count
  const panPositions = [];

  if (voiceCount === 1) {
    panPositions.push(63); // Center
  } else if (voiceCount === 2) {
    panPositions.push(0, 127); // Left, Right
  } else if (voiceCount === 3) {
    panPositions.push(0, 63, 127); // Left, Center, Right
  } else {
    // For 4 voices: Soprano (right), Alto (center-right), Tenor (center-left), Bass (left)
    panPositions.push(127, 84, 42, 0); // Far Right, Right, Left, Far Left
  }

  // Apply pan positions to voices
  for (let i = 0; i < voiceCount; i++) {
    setVoicePan(i, panPositions[i]);
  }
}

/**
 * Update device list in UI
 */
function updateDeviceList() {
  const deviceSelect = document.getElementById('midiOutputSelect');
  if (!deviceSelect) return;

  // Clear current options
  deviceSelect.innerHTML = '';

  // Add available devices
  const devices = getOutputDevices();
  if (devices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No MIDI devices available';
    deviceSelect.appendChild(option);
  } else {
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name;
      deviceSelect.appendChild(option);
    });
  }
}

/**
 * Get voice configuration
 * @param {number} voiceIndex - Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
 * @returns {Object} Voice configuration object
 */
function getVoiceConfig(voiceIndex) {
  if (voiceIndex < 0 || voiceIndex >= 4) return null;
  return { ...voiceConfig[voiceIndex] };
}

/**
 * Check if MIDI is enabled
 * @returns {boolean} True if MIDI is enabled
 */
function isMidiEnabled() {
  return midiEnabled;
}

// Export functions for use in player.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initMidi,
    getOutputDevices,
    selectOutputDevice,
    setMidiEnabled,
    noteOn,
    noteOff,
    setVoiceVolume,
    setVoicePan,
    setVoiceChannel,
    autoPanVoices,
    updateDeviceList,
    getVoiceConfig,
    isMidiEnabled
  };
}