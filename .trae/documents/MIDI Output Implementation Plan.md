# MIDI Output Implementation Plan

## Overview
Add MIDI output functionality to the Bach Generator, allowing users to send generated music to external MIDI devices instead of or in addition to the current Tone.js audio output.

## Implementation Steps

### 1. Create MIDI Module (`public/midi.js`)
- Implement Web MIDI API detection and initialization
- Create functions to enumerate available MIDI output devices
- Implement note_on/note_off messaging with proper MIDI channel assignment
- Add volume and panpot control via MIDI CC messages

### 2. Update HTML Interface (`public/index.html`)
- Add a new "MIDI Output" section with:
  - Dropdown selector for available MIDI output devices
  - Checkbox to toggle between Tone.js sampler and MIDI output
  - Individual controls for each voice (Soprano, Alto, Tenor, Bass):
    - MIDI channel selector (default: 1, 2, 3, 4)
    - Volume slider (MIDI CC 7)
    - Panpot slider (MIDI CC 10)
  - Auto-pan button to distribute voices across stereo field

### 3. Modify Player Logic (`public/player.js`)
- Add MIDI output mode alongside existing Tone.js sampler mode
- Implement voice-specific MIDI channel assignment
- Add panpot positioning based on voice count (spread across stereo field)
- Create toggle mechanism between Tone.js and MIDI output modes
- Ensure proper note_on/note_off timing matches existing playback

### 4. Integration Points
- Modify `generateAndPlay()` function to support both output modes
- Update `setupSamplers()` to handle MIDI initialization
- Ensure MIDI device selection persists across generations
- Add error handling for MIDI device disconnection

## Technical Details

### MIDI Channel Assignment
- Default channels: Soprano=1, Alto=2, Tenor=3, Bass=4
- User-configurable with dropdown selectors
- Channel numbers displayed as 1-16 (MIDI standard)

### Panpot Implementation
- Automatic stereo positioning based on voice count:
  - 1 voice: Center (0)
  - 2 voices: Left (-64), Right (+63)
  - 3 voices: Left (-64), Center (0), Right (+63)
  - 4 voices: Far Left (-64), Left (-21), Right (+21), Far Right (+63)
- Manual override via individual panpot sliders
- MIDI CC 10 (Pan) messages sent with note_on

### Volume Control
- Individual volume sliders for each voice
- MIDI CC 7 (Volume) messages sent on program change or slider adjustment
- Range: 0-127 (MIDI standard)

### Output Mode Toggle
- Single checkbox to switch between Tone.js and MIDI output
- Settings preserved when switching modes
- Clear visual indication of current output mode

## File Changes Summary

1. **New file**: `public/midi.js` - MIDI functionality implementation
2. **Modified**: `public/index.html` - Add MIDI controls to UI
3. **Modified**: `public/player.js` - Integrate MIDI output with existing playback logic

## Testing Considerations

- Test with various MIDI devices (hardware and software)
- Verify proper note timing and duration
- Test channel assignment and voice separation
- Validate panpot positioning with different voice counts
- Ensure smooth switching between output modes
- Test error handling when MIDI device is disconnected