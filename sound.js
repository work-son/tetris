// sound.js

// A simple sound engine for generating tones with the Web Audio API.
export default class Sound {
    constructor() {
        // Create an AudioContext.
        // The user must interact with the page for the audio to start.
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.isMuted = false;
    }

    // Toggles the sound on or off.
    toggleSound() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    // Plays a tone at a given frequency for a given duration.
    _playTone(frequency, duration, type = 'sine') {
        if (this.isMuted) return; // Don't play sound if muted

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // Create an oscillator
        const oscillator = this.audioCtx.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

        // Create a gain node to control the volume
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime); // Start with a volume
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

    // Sound for when a piece lands on the stack
    land() {
        this._playTone(100, 0.15, 'square');
    }

    clearLine() {
        this._playTone(600, 0.2, 'sine');
    }

    gameOver() {
        this._playTone(80, 0.5, 'sawtooth');
    }
}
