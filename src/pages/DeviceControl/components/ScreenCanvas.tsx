import React from 'react';

type Frame = { id: string; image: string };
interface ScreenCanvasProps {
  latestFrame: Frame | null;
  // Accept both object and callback refs; compatible with useRef<HTMLX | null>
  containerRef: React.Ref<HTMLDivElement>;
  imgRef: React.Ref<HTMLImageElement>;
  overlayRef: React.Ref<HTMLDivElement>;
  onImageLoad: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
}

export const ScreenCanvas: React.FC<ScreenCanvasProps> = ({
  latestFrame,
  containerRef,
  imgRef,
  overlayRef,
  onImageLoad,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  onKeyDown,
  onKeyUp,
}) => {
  return (
    <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
      <div
        ref={containerRef}
        className="canvas-placeholder"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: '#111827',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.75rem',
          boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        }}
      >
        {latestFrame ? (
          <>
            <img
              ref={imgRef}
              src={`data:image/jpeg;base64,${latestFrame.image}`}
              alt="screen-frame"
              onLoad={onImageLoad}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
            <div
              ref={overlayRef}
              className="overlay pointer-events-auto"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onWheel={onWheel}
              onContextMenu={(e) => { e.preventDefault(); }}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                background: 'transparent',
              }}
            />
          </>
        ) : (
          <div
            className="canvas-content"
            style={{ position: 'relative', zIndex: 3, color: '#D1D5DB' }}
          >
            <span className="canvas-text text-lg font-medium">Interactive Canvas Area</span>
          </div>
        )}
      </div>
    </div>
  );
};
