import { Component } from '@angular/core';

import { AudioFunComponent } from './components/audio-fun/audio-fun.component';

@Component({
  selector: 'app-root',
  imports: [AudioFunComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'loop-pad';
}
