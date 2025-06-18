import { Component } from '@angular/core';

@Component({
  selector: 'app-audio-fun',
  imports: [],
  templateUrl: './audio-fun.component.html',
  styleUrl: './audio-fun.component.css',
})
export class AudioFunComponent {
  mediaRecorder!: MediaRecorder;
  chunks: Blob[] = [];
  public is_recording: boolean = false;
  public recording: Blob | null = null;

  public async toggleRecording() {
    console.log(this.is_recording);
    if (this.is_recording) {
      this.stopRecording();
    } else {
      if (this.recording !== null) {
        this.playRecording();
      } else {
        await this.startRecording();
      }
    }
  }

  public async startRecording() {
    console.log('Starting recording...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];
    this.is_recording = true;

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
    this.is_recording = false;
  }

  playRecording() {
    const audio = new Audio(URL.createObjectURL(this.recording!));
    audio.play();
  }
}
