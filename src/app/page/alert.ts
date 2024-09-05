import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-markdown-alert',
  template: `
    <h1 style="background: yellow">
      <ng-content></ng-content>
    </h1>
  `,
})
export class MarkdownAlertComponent {
  constructor() {}
}
