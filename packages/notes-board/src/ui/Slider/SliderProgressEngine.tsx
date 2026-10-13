"use client";

import { useEffect } from "react";

export function SliderProgressEngine() {
  useEffect(() => {
    const updateProgress = (slider: HTMLInputElement) => {
      const min = parseFloat(slider.min) || 0;
      const max = parseFloat(slider.max) || 100;
      const val = parseFloat(slider.value) || 0;
      const progress = ((val - min) / (max - min)) * 100;
      slider.style.setProperty("--slider-progress", `${progress}%`);

      // Automatically inject min/max labels into Excalidraw inspector sliders
      if (slider.classList.contains('range-input')) {
        const parent = slider.parentElement;
        if (parent) {
          parent.style.position = 'relative';
          parent.style.display = 'flex';
          parent.style.flexDirection = 'column';
          let labelsContainer = slider.nextElementSibling;
          if (!labelsContainer || !labelsContainer.classList.contains('agy-slider-labels')) {
            const div = document.createElement('div');
            div.className = 'agy-slider-labels';
            div.innerHTML = `<span class="agy-slider-label-min">${min}</span><span class="agy-slider-label-max">${max}</span>`;
            parent.insertBefore(div, slider.nextSibling);
          }
        }
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.type === "range") {
        updateProgress(target);
      }
    };
    document.addEventListener("input", handleInput);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.tagName.toLowerCase() === "input" && (node as HTMLInputElement).type === "range") {
                updateProgress(node as HTMLInputElement);
              }
              const sliders = node.querySelectorAll?.('input[type="range"]');
              if (sliders) {
                sliders.forEach((slider) => updateProgress(slider as HTMLInputElement));
              }
            }
          });
        }
      });
    });

    document.querySelectorAll('input[type="range"]').forEach((slider) => {
      updateProgress(slider as HTMLInputElement);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const originalSet = descriptor?.set;

    if (originalSet) {
      Object.defineProperty(HTMLInputElement.prototype, "value", {
        set(val: string) {
          originalSet.call(this, val);
          if (this.type === "range") {
            updateProgress(this);
          }
        },
        get: descriptor?.get,
      });
    }

    return () => {
      document.removeEventListener("input", handleInput);
      observer.disconnect();
      if (originalSet && descriptor) {
        Object.defineProperty(HTMLInputElement.prototype, "value", descriptor);
      }
    };
  }, []);

  return null;
}
