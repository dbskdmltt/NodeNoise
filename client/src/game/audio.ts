// 로파이·앰비언트 배경음. 저작권 있는 트랙을 구해올 수 없어서, Web Audio API로
// 절차적으로 만든 저자극·저긴장 사운드스케이프로 대신한다: 천천히 바뀌는 패드
// 코드 진행 위에 이따금 펜타토닉 플럭 음을 흩뿌려 로파이 특유의 "멍한" 느낌을 낸다.
// 브라우저 자동재생 정책 때문에 실제 사용자 제스처(클릭/탭) 안에서 start()를
// 호출해야 소리가 난다 — scene.ts가 첫 pointerdown에서 호출한다.

export interface AmbientMusic {
  start: () => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
}

const MASTER_VOLUME = 0.45;
const CHORD_INTERVAL_MS = 7000;
const CHORD_FADE_IN = 3;
const CHORD_FADE_OUT = 9;
const PLINK_INTERVAL_MS = 4000;
const PLINK_CHANCE = 0.35;

// 잔잔한 로파이 코드 진행 — Am7 · Fmaj7 · Cmaj7 · G6 느낌의 저음역 보이싱.
const PAD_CHORDS: number[][] = [
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 349.23],
  [130.81, 164.81, 196.0, 261.63],
  [196.0, 246.94, 293.66, 392.0],
];

// 이따금 울리는 트윙클용 펜타토닉 스케일(C5~A5).
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

export function createAmbientMusic(): AmbientMusic {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let started = false;
  let disposed = false;
  let muted = false;
  let chordIndex = 0;
  let chordTimer: number | undefined;
  let plinkTimer: number | undefined;
  let prevChordNodes: { gain: GainNode; filter: BiquadFilterNode } | null = null;

  function playChord() {
    if (!ctx || !master) return;

    if (prevChordNodes) {
      try {
        prevChordNodes.filter.disconnect();
        prevChordNodes.gain.disconnect();
      } catch {
        // 이미 끊겨 있으면 무시 — 정리용 호출이라 실패해도 안전하다.
      }
    }

    const chord = PAD_CHORDS[chordIndex % PAD_CHORDS.length];
    chordIndex++;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(master);

    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0, now);
    chordGain.gain.linearRampToValueAtTime(0.06, now + CHORD_FADE_IN);
    chordGain.gain.linearRampToValueAtTime(0, now + CHORD_FADE_OUT);
    chordGain.connect(filter);

    chord.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 6; // 살짝 디튠해서 따뜻한 코러스감
      osc.connect(chordGain);
      osc.start(now);
      osc.stop(now + CHORD_FADE_OUT + 0.2);
    });

    prevChordNodes = { gain: chordGain, filter };
  }

  function playPlink() {
    if (!ctx || !master || Math.random() > PLINK_CHANCE) return;
    const now = ctx.currentTime;
    const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 2.3);
  }

  return {
    start() {
      if (started || disposed) return;
      started = true;

      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioContextCtor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOLUME;
      master.connect(ctx.destination);

      playChord();
      chordTimer = window.setInterval(playChord, CHORD_INTERVAL_MS);
      plinkTimer = window.setInterval(playPlink, PLINK_INTERVAL_MS);
    },
    setMuted(value: boolean) {
      muted = value;
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.2);
    },
    dispose() {
      disposed = true;
      if (chordTimer) window.clearInterval(chordTimer);
      if (plinkTimer) window.clearInterval(plinkTimer);
      ctx?.close();
    },
  };
}
