"use client";

import { useEffect } from "react";

/**
 * SliderProgressEngine
 * Provides legacy CSS progress variable updates and label injection for Excalidraw canvas range inputs (.range-input)
 * without monkey-patching HTMLInputElement.prototype, ensuring React controlled inputs remain completely uncorrupted.
 */
export function SliderProgressEngine() {
  useEffect(() => {
    const updateProgress = (slider: HTMLInputElement) => {
      const min = parseFloat(slider.min) || 0;
      const max = parseFloat(slider.max) || 100;
      const val = parseFloat(slider.value) || 0;
      const range = max - min || 1;
      const progress = Math.max(0, Math.min(100, ((val - min) / range) * 100));
      slider.style.setProperty("--slider-progress", `${progress}%`);

      // Automatically inject min/max labels into Excalidraw inspector sliders
      if (slider.classList.contains("range-input")) {
        const parent = slider.parentElement;
        if (parent) {
          parent.style.position = "relative";
          parent.style.display = "flex";
          parent.style.flexDirection = "column";
          let labelsContainer = slider.nextElementSibling;
          if (!labelsContainer || !labelsContainer.classList.contains("agy-slider-labels")) {
            const div = document.createElement("div");
            div.className = "agy-slider-labels";
            div.innerHTML = `<span class="agy-slider-label-min">${min}</span><span class="agy-slider-label-max">${max}</span>`;
            parent.insertBefore(div, slider.nextSibling);
          }
        }
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.type === "range" && target.classList.contains("range-input")) {
        updateProgress(target);
      }
    };

    document.addEventListener("input", handleInput);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (
                node.tagName.toLowerCase() === "input" &&
                (node as HTMLInputElement).type === "range" &&
                node.classList.contains("range-input")
              ) {
                updateProgress(node as HTMLInputElement);
              }
              const sliders = node.querySelectorAll?.('input.range-input[type="range"]');
              if (sliders) {
                sliders.forEach((slider) => updateProgress(slider as HTMLInputElement));
              }
            }
          });
        }
      });
    });

    document.querySelectorAll('input.range-input[type="range"]').forEach((slider) => {
      updateProgress(slider as HTMLInputElement);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("input", handleInput);
      observer.disconnect();
    };
  }, []);

  return null;
}
