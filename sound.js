// sound.js

// A simple sound engine for generating tones with the Web Audio API.
export default class Sound {
    constructor() {
        // Create an AudioContext.
        // The user must interact with the page for the audio to start.
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlayingMusic = false;
        this.musicInterval = null;
    }

    // Plays a tone at a given frequency for a given duration.
    _playTone(frequency, duration, type = 'sine') {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // Create an oscillator
        const oscillator = this.audioCtx.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

        // Create a gain node to control the volume
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime); // Start with a low volume
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration); // Fade out

        // Connect the nodes and start the oscillator
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + duration);
    }

    // --- Specific Game Sounds ---

    move() {
        this._playTone(200, 0.05, 'square');
    }

    rotate() {
        this._playTone(300, 0.05, 'sawtooth');
    }

    drop() {
        this._playTone(150, 0.1, 'triangle');
    }

    clearLine() {
        this._playTone(600, 0.2, 'sine');
    }

    gameOver() {
        this._playTone(100, 0.5, 'sawtooth');
    }

    // --- Background Music ---

    playMusic() {
        if (this.isPlayingMusic) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.isPlayingMusic = true;

        const C4 = 261.63;
        const D4 = 293.66;
        const E4 = 329.63;
        const G4 = 392.00;

        const melody = [E4, 0, C4, 0, D4, 0, G4, 0, C4, 0, D4, 0, E4, 0];
        let noteIndex = 0;

        this.musicInterval = setInterval(() => {
            const note = melody[noteIndex % melody.length];
            if (note > 0) {
                this._playTone(note, 0.15, 'triangle');
            }
            noteIndex++;
        }, 200);
    }

    stopMusic() {
        if (!this.isPlayingMusic) return;
        this.isPlayingMusic = false;
        clearInterval(this.musicInterval);
        this.musicInterval = null;
    }

    toggleMusic() {
        if (this.isPlayingMusic) {
            this.stopMusic();
        } else {
            this.playMusic();
        }
    }
}
