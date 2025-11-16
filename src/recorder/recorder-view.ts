//Needs access to settings (displaying settings info perhaps?)
// needs acces to FSM - looping/display
// needs access to audfio object for animations.

export class RecorderViewHandler {
  private htmlElement: HTMLElement;

  constructor(htmlElement: HTMLElement) {
    this.htmlElement = htmlElement;
    this.render();
  }

  render() {}
}
