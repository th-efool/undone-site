import React, { InputHTMLAttributes } from 'react';
import './Slider.css';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className = '', style, ...props }, ref) => {
    return (
      <div className="agy-slider-container" style={style}>
        <input
          type="range"
          ref={ref}
          className={`agy-slider ${className}`.trim()}
          {...props}
        />
        {(props.min !== undefined || props.max !== undefined) && (
          <div className="agy-slider-labels">
            <span className="agy-slider-label-min">{props.min}</span>
            <span className="agy-slider-label-max">{props.max}</span>
          </div>
        )}
      </div>
    );
  }
);

Slider.displayName = 'Slider';
