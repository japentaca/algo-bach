document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed");
  const playBtn = document.getElementById('playBtn');
  const statusDiv = document.getElementById('status');
  const formSelect = document.getElementById('formSelect');
  const durationSelect = document.getElementById('durationSelect');

  if (!playBtn) console.error("playBtn not found!");
  if (!statusDiv) console.error("statusDiv not found!");

  let synths = [];
  let limiter;

  async function initAudio() {
    console.log("Initializing Audio...");
    await Tone.start();
    console.log("Audio Context Started");

    if (!limiter) {
      limiter = new Tone.Limiter(-1).toDestination();
    }

    if (synths.length === 0) {
      // Create 4 synths for SATB, each with different panning
      // Soprano (0): Right (0.4)
      // Alto (1): Center-Right (0.15)
      // Tenor (2): Center-Left (-0.15)
      // Bass (3): Left (-0.4)
      const pans = [0.4, 0.15, -0.15, -0.4];

      for (let i = 0; i < 4; i++) {
        const panner = new Tone.Panner(pans[i]).connect(limiter);
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.8,
            release: 1.2
          },
          volume: -10 // Slightly lower volume per voice to prevent clipping
        }).connect(panner);
        synths.push(synth);
      }
    }
  }

  async function generateAndPlay() {
    console.log("Generate button clicked");
    statusDiv.innerText = "Generating...";
    playBtn.disabled = true;

    try {
      await initAudio();

      const form = formSelect.value;
      const durationCategory = durationSelect.value;
      
      // Map duration category to number of bars
      // 1 = short (~1m), 3 = medium (~3m), 5 = long (~5m)
      // At 120 BPM, 4/4 time: 1 bar = 2 seconds, so:
      // 1 min = 30 bars, 3 min = 90 bars, 5 min = 150 bars
      let barsToGenerate = parseInt(durationCategory) * 30;
      
      console.log(`Fetching: /api/generate?key=C&style=chorale&form=${form}&duration=${barsToGenerate}`);

      const response = await fetch(`/api/generate?key=C&style=chorale&form=${form}&duration=${barsToGenerate}`);
      if (!response.ok) throw new Error("Server error");

      const data = await response.json();
      console.log("Data received:", data);
      console.log("Total notes:", data.notes.length);

      statusDiv.innerHTML = `
                <strong>Playing:</strong> ${data.meta.style} in ${data.meta.key}<br>
                <strong>Progression:</strong> ${data.meta.progression}
            `;

      const now = Tone.now() + 0.5;
      // At 120 BPM, quarter note = 0.5 seconds
      // Each "beat unit" in our system = quarter note
      const beatDuration = 0.5;

      data.notes.forEach(note => {
        const humanizeStart = (Math.random() * 0.02) - 0.01;
        const humanizeDuration = (Math.random() * 0.05);
        const time = now + (note.startTime * beatDuration) + humanizeStart;

        let noteBeats = 2;
        if (note.duration === "4n") noteBeats = 1;
        if (note.duration === "8n") noteBeats = 0.5;

        const durationSecs = (noteBeats * beatDuration) - 0.05 + humanizeDuration;

        let velocity = 0.7 + (Math.random() * 0.1);
        if (note.voice === 3) velocity = 0.8;
        if (note.voice === 0) velocity = 0.8;

        // Trigger the correct synth based on voice index
        // Ensure voice index is within bounds (0-3)
        const voiceIndex = Math.min(Math.max(note.voice, 0), 3);
        synths[voiceIndex].triggerAttackRelease(note.pitch, durationSecs, time, velocity);
      });

      const lastNote = data.notes[data.notes.length - 1];
      const lastNoteBeats = lastNote.duration === "4n" ? 1 : lastNote.duration === "8n" ? 0.5 : 2;
      const durationSecs = (lastNote.startTime * beatDuration) + (lastNoteBeats * beatDuration) + 3;

      setTimeout(() => {
        statusDiv.innerText = "Ready";
        playBtn.disabled = false;
      }, durationSecs * 1000);

    } catch (e) {
      console.error(e);
      statusDiv.innerText = "Error: " + e.message;
      playBtn.disabled = false;
    }
  }

  playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    generateAndPlay();
  });
  console.log("Event listener added to playBtn");
});
