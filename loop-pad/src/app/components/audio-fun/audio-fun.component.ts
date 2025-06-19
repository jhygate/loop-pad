import { Component } from '@angular/core';

type RecorderState = 'empty' | 'recording' | 'ready_to_play' | 'playing';

@Component({
  selector: 'app-audio-fun',
  imports: [],
  templateUrl: './audio-fun.component.html',
  styleUrl: './audio-fun.component.css',
})
export class AudioFunComponent {
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

  playRecording() {
    const audio = new Audio(URL.createObjectURL(this.recording!));
    audio.play();
  }
}
