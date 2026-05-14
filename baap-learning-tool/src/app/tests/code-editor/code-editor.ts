import { CommonModule, TitleCasePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-code-editor',
  imports: [FormsModule, CommonModule, TitleCasePipe],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss',
})
export class CodeEditor {
  @ViewChild('jsFrame') jsFrame!: ElementRef;
  tech: WritableSignal<string> = signal('html');
  isDarkTheme: WritableSignal<boolean> = signal(false);
  isRowLayout: WritableSignal<boolean> = signal(false);
  techList = signal(['html', 'css', 'js', 'bootstrap', 'angular']);
  codeMap: WritableSignal<{ [key: string]: string }> = signal({
    html: '',
    css: '',
    js: '',
    bootstrap: '',
    angular: '',
  });

  selectTech(t: string): void {
    this.tech?.set(t);
  }

  runCode(): void {
    const techType = this.tech();
    const code = this.codeMap()[techType];
    const iframe = this.jsFrame?.nativeElement as HTMLIFrameElement;
    if (!iframe) {
      return;
    }

    let srcdoc = '';
    if (techType === 'html') {
      srcdoc = code;
    } else if (techType === 'css') {
      srcdoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>${code}</style>
          </head>
          <body>
            <h1>CSS Demo</h1>
            <p>Type your CSS code above to style this page!</p>
          </body>
        </html>
      `;
    } else if (techType === 'js') {
      srcdoc = `
        <!DOCTYPE html>
        <html>
          <body>
            <script>
              try {
                ${code}
              } catch(e) {
                document.body.innerHTML = '<pre style="color:red;">' + e + '</pre>';
              }
            </script>
          </body>
        </html>
      `;
    } else if (techType === 'bootstrap') {
      srcdoc = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
          </head>
          <body>
            ${code}
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
          </body>
        </html>
      `;
    } else {
      srcdoc = `<div style="padding: 20px;">The Angular tab is for demonstration. A complete Angular application cannot be run within this simple iframe. Please use the other tabs.</div>`;
    }

    setTimeout(() => {
      iframe.srcdoc = srcdoc;
    }, 0);
  }

  toggleLayout(): void {
    this.isRowLayout?.update((value) => !value);
  }

  toggleTheme(): void {
    this.isDarkTheme?.update((value) => !value);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event?.key === 'Enter') {
      event?.preventDefault();
      this.runCode();
    }
  }

  copyCode(): void {
    const code = this.codeMap()[this.tech()];
    if (code) {
      navigator?.clipboard?.writeText(code)?.catch(() => {});
    }
  }
}
