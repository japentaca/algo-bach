const playBtn = document.getElementById('playBtn');
const statusDiv = document.getElementById('status');

let synth;
let limiter;

async function initAudio() {
  await Tone.start();

  if (!limiter) {
    // 1. Limiter to prevent clipping with multiple voices
    limiter = new Tone.Limiter(-1).toDestination();
  }

  if (!synth) {
    // 2. Simple Sine Tones (as requested)
    // Using PolySynth to handle chords/polyphony
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine" // Pure sine waves
      },
      envelope: {
        attack: 0.02, // Fast but not clicking
        decay: 0.1,
        sustain: 0.8, // Higher sustain for organ-like feel
        release: 1.2  // Long release for church acoustic feel
      },
      volume: -8 // Reduce volume to prevent clipping before limiter
    }).connect(limiter);
  }
}

async function generateAndPlay() {
  statusDiv.innerText = "Generating...";
  playBtn.disabled = true;

  try {
    await initAudio();

    const formSelect = document.getElementById('formSelect');
    const form = formSelect.value;
    const response = await fetch(`/api/generate?key=C&style=chorale&form=${form}`);
    if (!response.ok) throw new Error("Server error");

    const data = await response.json();

    statusDiv.innerHTML = `
        <strong>Playing:</strong> ${data.meta.style} in ${data.meta.key}<br>
        <strong>Progression:</strong> ${data.meta.progression}
    `;

    const now = Tone.now() + 0.5; // Start 0.5s from now
    const beatDuration = 0.6; // Slower tempo (approx 100 BPM) for better interpretation

    data.notes.forEach(note => {
      // 3. Humanization (Timing & Interpretation)
      // Add slight random offset to start time (human imperfection)
      const humanizeStart = (Math.random() * 0.02) - 0.01; // +/- 10ms

      // Add slight variation to duration (articulation)
      // Legato feel but distinct
      const humanizeDuration = (Math.random() * 0.05);

      const time = now + (note.startTime * beatDuration) + humanizeStart;

      // Calculate duration based on beatDuration
      // Note: Tone.js duration strings like "2n" are relative to Tone.Transport.bpm
      // Here we are manually scheduling, so we should convert "2n" to seconds or use beats.
      // Our backend returns "2n" (half note) = 2 beats.
      // "4n" (quarter note) = 1 beat.

      let noteBeats = 2; // Default 2n
      if (note.duration === "4n") noteBeats = 1;

      const durationSecs = (noteBeats * beatDuration) - 0.05 + humanizeDuration; // Slight gap for articulation

      // 4. Dynamics (Velocity)
      // Inner voices slightly softer?
      let velocity = 0.7 + (Math.random() * 0.1);
      if (note.voice === 3) velocity = 0.8; // Bass slightly louder
      if (note.voice === 0) velocity = 0.8; // Soprano slightly louder

      synth.triggerAttackRelease(note.pitch, durationSecs, time, velocity);
    });

    // Re-enable button after approximate duration
    const lastNote = data.notes[data.notes.length - 1];
    const lastNoteBeats = lastNote.duration === "4n" ? 1 : 2;
    const duration = (lastNote.startTime * beatDuration) + (lastNoteBeats * beatDuration) + 3;

    setTimeout(() => {
      statusDiv.innerText = "Ready";
      playBtn.disabled = false;
    }, duration * 1000);

  } catch (e) {
    console.error(e);
    statusDiv.innerText = "Error: " + e.message;
    playBtn.disabled = false;
  }
}

playBtn.addEventListener('click', generateAndPlay);
