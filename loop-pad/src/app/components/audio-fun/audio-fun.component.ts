import { Component, signal } from '@angular/core';
import { clsx } from 'clsx';

type RecorderState = 'empty' | 'recording' | 'ready_to_play' | 'playing';

@Component({
  selector: 'app-audio-fun',
  imports: [],
  templateUrl: './audio-fun.component.html',
  styleUrl: './audio-fun.component.css',
})
export class AudioFunComponent {
  public readonly clsx = clsx;

  private audio!: HTMLAudioElement;
  public currentTime = 0;
  public duration = 0;

  mediaRecorder!: MediaRecorder;
  chunks: Blob[] = [];
  public recording: Blob | null = null;

  public state: RecorderState = 'empty';

  public async toggleRecording() {
    if (this.state === 'empty') {
      this.startRecording();
      this.state = 'recording';
    } else if (this.state === 'recording') {
      this.stopRecording();
      this.state = 'ready_to_play';
    } else if (this.state === 'ready_to_play') {
      this.playRecording();
      this.state = 'playing';
    }
  }

  public async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      this.recording = blob;
    };

    this.mediaRecorder.start();
  }

  stopRecording() {
    this.mediaRecorder.stop();
  }

  public playRecording() {
    if (!this.recording) return;

    this.startAnimation();

    const url = URL.createObjectURL(this.recording);
    this.audio = new Audio();

    this.audio.addEventListener('loadedmetadata', () => {
      if (isFinite(this.audio.duration)) {
        this.duration = this.audio.duration;
        this.audio.play();
      } else {
        // Sometimes metadata isn't ready yet. Use a fallback.
        this.audio.addEventListener('durationchange', () => {
          if (isFinite(this.audio.duration)) {
            this.duration = this.audio.duration;
          }
        });
        this.audio.play();
      }

      this.state = 'playing';
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
    });

    this.audio.addEventListener('ended', () => {
      this.state = 'ready_to_play';
      URL.revokeObjectURL(url);
    });

    this.audio.src = url;
  }

  private startTime = 0;
  private animationFrame: number | null = null;

  progress = signal(0);

  private startAnimation() {
    this.progress.set(0);
    this.startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - this.startTime;
      const percent = Math.min((elapsed / this.duration) * 100, 100);
      this.progress.set(percent);

      if (percent < 100) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    this.animationFrame && cancelAnimationFrame(this.animationFrame);
    this.animationFrame = requestAnimationFrame(animate);
  }
}
