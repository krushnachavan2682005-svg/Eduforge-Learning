import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Renderer2,
  Inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class Tooltip {
  @Input('appTooltip') tooltipText = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private tooltip!: HTMLElement;
  private arrow!: HTMLElement;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  @HostListener('mouseenter')
  onMouseEnter() {
    if (!this.tooltipText) return;

    // Tooltip element
    this.tooltip = this.renderer?.createElement('div');
    this.tooltip.innerText = this.tooltipText;

    // Tailwind tooltip styles
    // Use fixed positioning so the tooltip is not clipped by overflow
    this.renderer?.setStyle(this.tooltip, 'position', 'fixed');
    this.renderer?.addClass(this.tooltip, 'bg-gray-800');
    this.renderer?.addClass(this.tooltip, 'text-white');
    this.renderer?.addClass(this.tooltip, 'text-sm');
    this.renderer?.addClass(this.tooltip, 'px-2');
    this.renderer?.addClass(this.tooltip, 'py-1');
    this.renderer?.addClass(this.tooltip, 'rounded');
    // Allow full text to show (wrap to multiple lines if long)
    this.renderer?.setStyle(this.tooltip, 'white-space', 'normal');
    this.renderer?.setStyle(this.tooltip, 'max-width', '480px');
    this.renderer?.setStyle(this.tooltip, 'word-break', 'break-word');
    this.renderer?.setStyle(this.tooltip, 'line-height', '1.2');
    this.renderer?.addClass(this.tooltip, 'z-50');
    this.renderer?.addClass(this.tooltip, 'pointer-events-none');
    this.renderer?.addClass(this.tooltip, 'select-none');
    this.renderer?.setStyle(this.tooltip, 'opacity', '0.9');

    // Arrow element
    this.arrow = this.renderer?.createElement('span');
    this.renderer?.addClass(this.arrow, 'absolute');
    this.renderer?.setStyle(this.arrow, 'width', '0');
    this.renderer?.setStyle(this.arrow, 'height', '0');

    // Add tooltip + arrow to document body to avoid clipping by overflow
    const body = this.document?.body;
    if (!body) return;

    this.renderer?.appendChild(body, this.tooltip);
    this.renderer?.appendChild(this.tooltip, this.arrow); // append arrow *inside* tooltip

    // Set hidden position first
    this.renderer?.setStyle(this.tooltip, 'visibility', 'hidden');
    this.renderer?.setStyle(this.tooltip, 'top', '0px');
    this.renderer?.setStyle(this.tooltip, 'left', '0px');

    const hostRect = this.el?.nativeElement?.getBoundingClientRect();
    if (this.tooltipPosition === 'top' && hostRect?.width) {
      this.renderer?.setStyle(this.tooltip, 'width', `${hostRect?.width}px`);
      this.renderer?.removeStyle(this.tooltip, 'max-width');
    } else {
      this.renderer?.removeStyle(this.tooltip, 'width');
      this.renderer?.setStyle(this.tooltip, 'max-width', '480px');
    }

    const tooltipWidth = this.tooltip?.offsetWidth;
    const tooltipHeight = this.tooltip?.offsetHeight;

    let top = 0;
    let left = 0;

    // Reset arrow before applying new one
    this.arrow?.removeAttribute('style');

    switch (this.tooltipPosition) {
      case 'top':
        top = hostRect?.top - tooltipHeight - 1;
        left = Math?.max(8, Math?.min(hostRect?.left + (hostRect?.width - tooltipWidth) / 2, window?.innerWidth - tooltipWidth - 8));

        // arrow bottom-facing triangle
        this.setArrowStyles({
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid #1f2937', // Tailwind's bg-gray-800
        });
        break;

      case 'bottom':
        top = hostRect?.bottom + 8 
        left = Math?.max(8, Math?.min(hostRect?.left + (hostRect?.width - tooltipWidth) / 2, window?.innerWidth - tooltipWidth - 8));

        // arrow top-facing triangle
        this.setArrowStyles({
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '5px solid #1f2937',
        });
        break;

      case 'left':
        top = hostRect?.top + (hostRect?.height - tooltipHeight) / 2;
        left = hostRect?.left - tooltipWidth - 8;

        // arrow right-facing triangle
        this.setArrowStyles({
          top: '50%',
          right: '-5px',
          transform: 'translateY(-50%)',
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '5px solid #1f2937',
        });
        break;

      case 'right':
        top = hostRect?.top + (hostRect?.height - tooltipHeight) / 2;
        left = hostRect?.right + 8;

        // arrow left-facing triangle
        this.setArrowStyles({
          top: '50%',
          left: '-5px',
          transform: 'translateY(-50%)',
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderRight: '5px solid #1f2937',
        });
        break;
    }

    this.renderer?.setStyle(this.tooltip, 'top', `${top}px`);
    this.renderer?.setStyle(this.tooltip, 'left', `${left}px`);
    this.renderer?.setStyle(this.tooltip, 'visibility', 'visible');
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    if (this.tooltip) {
      this.tooltip?.remove();
      this.tooltip = null!;
      this.arrow = null!;
    }
  }

  @HostListener('click')
  onClick() {
    if (this.tooltip) {
      this.tooltip?.remove();
      this.tooltip = null!;
      this.arrow = null!;
    }
  }

  private setArrowStyles(styles: { [key: string]: string }) {
    Object?.entries(styles)?.forEach(([key, value]) => {
      this.renderer?.setStyle(this.arrow, key, value);
    });
  }
}
