import React from 'react';
import type {FrameBatch} from './types.ts';

interface ScreenCanvasProps {
  latestBatch: FrameBatch | null;
  containerRef: React.Ref<HTMLDivElement>;
  canvasRef: React.Ref<HTMLCanvasElement>;
  overlayRef: React.Ref<HTMLDivElement>;
  width: number; // natural width of full frame
  height: number; // natural height of full frame
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

export const ScreenCanvas: React.FC<ScreenCanvasProps> = ({
  latestBatch,
  containerRef,
  canvasRef,
  overlayRef,
  width,
  height,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  onKeyDown,
  onKeyUp,
  disabled,
}) => {
  const aspectRatio = width && height ? `${width}/${height}` : '16/9';

  return (
    <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
      <div
        ref={containerRef}
        className="canvas-placeholder"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          background: '#111827',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        }}
      >
        {width && height ? (
          <>
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                zIndex: 1,
                pointerEvents: 'none',
                background: '#000',
              }}
            />
            <div
              ref={overlayRef}
              className="overlay pointer-events-auto"
              onPointerDown={disabled ? undefined : onPointerDown}
              onPointerMove={disabled ? undefined : onPointerMove}
              onPointerUp={disabled ? undefined : onPointerUp}
              onPointerCancel={disabled ? undefined : onPointerCancel}
              onWheel={disabled ? undefined : onWheel}
              onContextMenu={(e) => { e.preventDefault(); }}
              tabIndex={0}
              onKeyDown={disabled ? undefined : onKeyDown}
              onKeyUp={disabled ? undefined : onKeyUp}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                background: 'transparent',
                outline: 'none',
              }}
            />
          </>
        ) : (
          <div style={{ position: 'relative', zIndex: 3, color: '#D1D5DB' }}>
            <span className="text-lg font-medium">Waiting for first full frame...</span>
          </div>
        )}
      </div>
    </div>
  );
};
