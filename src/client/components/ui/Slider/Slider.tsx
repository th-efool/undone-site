import React, {
  InputHTMLAttributes,
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import './Slider.css';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onDragStateChange?: (isDragging: boolean) => void;
  showLabels?: boolean;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className = '',
      style,
      min = 0,
      max = 100,
      step = 1,
      value,
      defaultValue,
      onChange,
      onInput,
      disabled = false,
      showLabels = false,
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const trackWrapRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => inputRef.current!);

    const numMin = Number(min);
    const numMax = Number(max);
    const numStep = step === 'any' ? 1 : Number(step) || 1;

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<number>(() => {
      if (isControlled) return Number(value);
      if (defaultValue !== undefined) return Number(defaultValue);
      return numMin;
    });

    const [isDragging, setIsDragging] = useState(false);

    // Keep internal value in sync with controlled value prop
    useEffect(() => {
      if (isControlled) {
        setInternalValue(Number(value));
      }
    }, [isControlled, value]);

    const currentValue = isControlled ? Number(value) : internalValue;
    const clampedValue = Math.max(numMin, Math.min(numMax, currentValue));
    const rangeSpan = numMax - numMin || 1;
    const percent = Math.max(0, Math.min(100, ((clampedValue - numMin) / rangeSpan) * 100));

    // Dispatch native/synthetic change event on input element
    const emitChange = useCallback(
      (newVal: number) => {
        if (!isControlled) {
          setInternalValue(newVal);
        }
        if (inputRef.current) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(inputRef.current, newVal.toString());
          } else {
            inputRef.current.value = newVal.toString();
          }

          // Emit synthetic change event for React listeners
          const event = new Event('change', { bubbles: true });
          inputRef.current.dispatchEvent(event);
        }
      },
      [isControlled]
    );

    const updateFromPointer = useCallback(
      (clientX: number) => {
        if (!trackWrapRef.current) return;
        const rect = trackWrapRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;

        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        let rawVal = numMin + ratio * (numMax - numMin);

        if (numStep > 0) {
          const stepCount = Math.round((rawVal - numMin) / numStep);
          rawVal = numMin + stepCount * numStep;
        }

        const nextVal = Math.max(numMin, Math.min(numMax, rawVal));
        emitChange(nextVal);
      },
      [numMin, numMax, numStep, emitChange]
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.button !== 0) return; // Only primary mouse button

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      setIsDragging(true);
      props.onDragStateChange?.(true);
      updateFromPointer(e.clientX);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || disabled) return;
      updateFromPointer(e.clientX);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
      props.onDragStateChange?.(false);
    };

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(e);
    };

    return (
      <div
        className={`agy-slider-container ${className}`.trim()}
        style={{
          ...style,
          ['--slider-progress' as any]: `${percent}%`,
        }}
      >
        <div
          ref={trackWrapRef}
          className={`agy-slider-track-wrap ${isDragging ? 'agy-slider-dragging' : ''} ${
            disabled ? 'agy-slider-disabled' : ''
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Visual Track */}
          <div className="agy-slider-track">
            {/* Edge-to-edge progress fill */}
            <div
              className="agy-slider-fill"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Visual Thumb: translateX(-percent%) guarantees 0% flush left and 100% flush right */}
          <div
            className={`agy-slider-thumb ${isDragging ? 'agy-slider-thumb-active' : ''}`}
            style={{
              left: `${percent}%`,
              transform: `translate(-${percent}%, -50%)`,
            }}
            aria-hidden="true"
          />

          {/* Accessible transparent range input for tests, keyboard, and accessibility */}
          <input
            type="range"
            ref={inputRef}
            className="agy-slider agy-slider-native-input"
            min={min}
            max={max}
            step={step}
            value={clampedValue}
            onChange={handleNativeChange}
            onInput={onInput}
            disabled={disabled}
            {...props}
          />
        </div>

        {showLabels && (
          <div className="agy-slider-labels">
            <span className="agy-slider-label-min">{min}</span>
            <span className="agy-slider-label-max">{max}</span>
          </div>
        )}
      </div>
    );
  }
);

Slider.displayName = 'Slider';

