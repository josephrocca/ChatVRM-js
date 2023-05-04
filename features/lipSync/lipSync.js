const TIME_DOMAIN_DATA_LENGTH = 2048;

export class LipSync {
  // public readonly audio: AudioContext;
  // public readonly analyser: AnalyserNode;
  // public readonly timeDomainData: Float32Array;

  constructor(audio) {
    this.audio = audio;

    this.analyser = audio.createAnalyser();
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH);
  }

  update() {
    this.analyser.getFloatTimeDomainData(this.timeDomainData);

    let volume = 0.0;
    for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
      volume = Math.max(volume, Math.abs(this.timeDomainData[i]));
    }

    // cook
    volume = 1 / (1 + Math.exp(-45 * volume + 5));
    if (volume < 0.1) volume = 0;

    return {
      volume,
    };
  }

  async playFromArrayBuffer(buffer, onEnded, {volume=1}={}) {
    const audioBuffer = await this.audio.decodeAudioData(buffer);

    const bufferSource = this.audio.createBufferSource();
    bufferSource.buffer = audioBuffer;

    // Create a gain node to control the volume
    const gainNode = this.audio.createGain();
    gainNode.gain.value = volume;

    // Connect the bufferSource to the gainNode and the gainNode to the destination
    bufferSource.connect(gainNode);
    gainNode.connect(this.audio.destination);

    // Connect the bufferSource directly to the analyser to get raw audio data
    bufferSource.connect(this.analyser);

    bufferSource.start();
    if (onEnded) {
      bufferSource.addEventListener("ended", onEnded);
    }
  }

  async playFromURL(url, onEnded) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    this.playFromArrayBuffer(buffer, onEnded);
  }
}
