import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { blobToFile, preloadImage } from '../../util/files';
import { clamp } from '../../util/math';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import Button from './Button';
import Modal from './Modal';
import RangeSlider from './RangeSlider';

import styles from './MediaEditor.module.scss';

type OwnProps = {
  isOpen: boolean;
  imageUrl?: string;
  onClose: VoidFunction;
  onSave: (file: File) => void;
};

type EditorMode = 'draw' | 'crop';

interface DrawAction {
  type: 'draw';
  points: Array<{ x: number; y: number }>;
  color: string;
  brushSize: number;
}

const PREDEFINED_COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
];

const DEFAULT_BRUSH_SIZE = 5;
const MIN_BRUSH_SIZE = 2;
const MAX_BRUSH_SIZE = 50;
const MIN_ZOOM = 100;
const MAX_ZOOM = 300;

const MediaEditor = ({
  isOpen,
  imageUrl,
  onClose,
  onSave,
}: OwnProps) => {
  const lang = useLang();

  const canvasRef = useRef<HTMLCanvasElement>();
  const imageRef = useRef<HTMLImageElement | undefined>(undefined);
  const contextRef = useRef<CanvasRenderingContext2D | undefined>(undefined);
  const gpuContextRef = useRef<any>(undefined);
  const gpuDeviceRef = useRef<any>(undefined);

  const [mode, setMode] = useState<EditorMode>('draw');
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [drawActions, setDrawActions] = useState<DrawAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawAction | undefined>(undefined);
  const [isDrawing, markDrawing, unmarkDrawing] = useFlag(false);
  const [isWebGPUSupported, setIsWebGPUSupported] = useState(false);

  // Crop state
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const lastImagePosition = useRef({ x: 0, y: 0 });

  // Initialize WebGPU or fallback to Canvas 2D
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const initCanvas = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const image = await preloadImage(imageUrl);
      imageRef.current = image;

      canvas.width = image.width;
      canvas.height = image.height;

      // Try WebGPU first
      if ('gpu' in navigator) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            const device = await adapter.requestDevice();
            gpuDeviceRef.current = device;

            const context = canvas.getContext('webgpu');
            if (context) {
              gpuContextRef.current = context;
              const format = navigator.gpu.getPreferredCanvasFormat();
              context.configure({
                device,
                format,
                alphaMode: 'premultiplied',
              });
              setIsWebGPUSupported(true);
              renderWithWebGPU();
              return;
            }
          }
        } catch {
          // WebGPU not available, fall back to Canvas 2D
        }
      }

      // Fallback to Canvas 2D
      const ctx = canvas.getContext('2d');
      if (ctx) {
        contextRef.current = ctx;
        renderWith2D();
      }
    };

    initCanvas();
  }, [isOpen, imageUrl]);

  // Render with WebGPU
  const renderWithWebGPU = useLastCallback(() => {
    const canvas = canvasRef.current;
    const context = gpuContextRef.current;
    const device = gpuDeviceRef.current;
    const image = imageRef.current;

    if (!canvas || !context || !device || !image) return;

    // For WebGPU, we use a hybrid approach: render image and drawings to an offscreen 2D canvas
    // then copy to WebGPU context for potential future GPU-accelerated effects
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Draw image
    offCtx.drawImage(image, 0, 0);

    // Apply all draw actions
    drawActions.forEach((action) => {
      renderDrawAction(offCtx, action);
    });

    // Draw current action if drawing
    if (currentAction) {
      renderDrawAction(offCtx, currentAction);
    }

    // Copy to main canvas via 2D context for now
    // (Full WebGPU shader-based rendering can be added for more advanced effects)
    const mainCtx = canvas.getContext('2d');
    if (mainCtx) {
      mainCtx.drawImage(offscreen, 0, 0);
    }
  });

  // Render with Canvas 2D
  const renderWith2D = useLastCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const image = imageRef.current;

    if (!canvas || !ctx || !image) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    // Apply all draw actions
    drawActions.forEach((action) => {
      renderDrawAction(ctx, action);
    });

    // Draw current action if drawing
    if (currentAction) {
      renderDrawAction(ctx, currentAction);
    }
  });

  const renderDrawAction = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
    if (action.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(action.points[0].x, action.points[0].y);
    for (let i = 1; i < action.points.length; i++) {
      ctx.lineTo(action.points[i].x, action.points[i].y);
    }
    ctx.stroke();
  };

  // Re-render when actions change
  useEffect(() => {
    if (isWebGPUSupported) {
      renderWithWebGPU();
    } else {
      renderWith2D();
    }
  }, [drawActions, currentAction, isWebGPUSupported, renderWith2D, renderWithWebGPU]);

  const getCanvasCoordinates = useLastCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  });

  const handleDrawStart = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw') return;

    markDrawing();
    const coords = getCanvasCoordinates(e.nativeEvent);
    setCurrentAction({
      type: 'draw',
      points: [coords],
      color: selectedColor,
      brushSize,
    });
  });

  const handleDrawMove = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== 'draw' || !currentAction) return;

    const coords = getCanvasCoordinates(e.nativeEvent);
    setCurrentAction({
      ...currentAction,
      points: [...currentAction.points, coords],
    });
  });

  const handleDrawEnd = useLastCallback(() => {
    if (!isDrawing || !currentAction) return;

    unmarkDrawing();
    if (currentAction.points.length > 1) {
      setDrawActions((prev) => [...prev, currentAction]);
    }
    setCurrentAction(undefined);
  });

  // Crop mode handlers
  const handleCropStart = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'crop') return;

    isDragging.current = true;
    const clientX = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientX : e.nativeEvent.clientX;
    const clientY = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientY : e.nativeEvent.clientY;
    lastMousePosition.current = { x: clientX, y: clientY };
    lastImagePosition.current = { ...imagePosition };
  });

  const handleCropMove = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'crop' || !isDragging.current) return;

    const clientX = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientX : e.nativeEvent.clientX;
    const clientY = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientY : e.nativeEvent.clientY;
    const deltaX = clientX - lastMousePosition.current.x;
    const deltaY = clientY - lastMousePosition.current.y;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxOffset = (zoom - 100) / 100 * canvas.width / 2;
    setImagePosition({
      x: clamp(lastImagePosition.current.x + deltaX, -maxOffset, maxOffset),
      y: clamp(lastImagePosition.current.y + deltaY, -maxOffset, maxOffset),
    });
  });

  const handleCropEnd = useLastCallback(() => {
    isDragging.current = false;
  });

  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'draw') {
      handleDrawStart(e);
    } else {
      handleCropStart(e);
    }
  });

  const handlePointerMove = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'draw') {
      handleDrawMove(e);
    } else {
      handleCropMove(e);
    }
  });

  const handlePointerUp = useLastCallback(() => {
    if (mode === 'draw') {
      handleDrawEnd();
    } else {
      handleCropEnd();
    }
  });

  const handleUndo = useLastCallback(() => {
    setDrawActions((prev) => prev.slice(0, -1));
  });

  const handleClear = useLastCallback(() => {
    setDrawActions([]);
  });

  const handleSave = useLastCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    // Create output canvas
    const outputCanvas = document.createElement('canvas');

    if (mode === 'crop') {
      // Apply crop
      const scale = zoom / 100;
      const cropSize = Math.min(canvas.width, canvas.height) / scale;
      const cropX = (canvas.width / 2) - (cropSize / 2) - (imagePosition.x / scale);
      const cropY = (canvas.height / 2) - (cropSize / 2) - (imagePosition.y / scale);

      outputCanvas.width = cropSize;
      outputCanvas.height = cropSize;
      const ctx = outputCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);
      }
    } else {
      // Save full canvas with drawings
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const ctx = outputCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0);
      }
    }

    outputCanvas.toBlob((blob) => {
      if (blob) {
        const file = blobToFile(blob, 'edited-image.png');
        onSave(file);
        onClose();
      }
    }, 'image/png');
  });

  const handleModeChange = useLastCallback((newMode: EditorMode) => {
    setMode(newMode);
    if (newMode === 'crop') {
      setZoom(MIN_ZOOM);
      setImagePosition({ x: 0, y: 0 });
    }
  });

  const canvasStyle = mode === 'crop' ? buildStyle(
    `transform: scale(${zoom / 100}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
  ) : undefined;

  function renderHeader() {
    return (
      <div className="modal-header-condensed">
        <Button round color="translucent" size="smaller" ariaLabel={lang('Close')} onClick={onClose}>
          <Icon name="close" />
        </Button>
        <div className="modal-title">{lang('EditMedia')}</div>
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={lang('Save')}
          onClick={handleSave}
        >
          <Icon name="check" />
        </Button>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      header={renderHeader()}
      className={styles.root}
    >
      <div className={styles.canvasWrapper}>
        <div
          className={buildClassName(styles.canvasContainer, mode === 'crop' && styles.cropMode)}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={canvasStyle}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
          {mode === 'crop' && <div className={styles.cropOverlay} />}
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.modeSelector}>
          <Button
            className={buildClassName(styles.modeButton, mode === 'draw' && styles.active)}
            round
            size="smaller"
            color={mode === 'draw' ? 'primary' : 'translucent'}
            onClick={() => handleModeChange('draw')}
            ariaLabel={lang('Draw')}
          >
            <Icon name="edit" />
          </Button>
          <Button
            className={buildClassName(styles.modeButton, mode === 'crop' && styles.active)}
            round
            size="smaller"
            color={mode === 'crop' ? 'primary' : 'translucent'}
            onClick={() => handleModeChange('crop')}
            ariaLabel={lang('Crop')}
          >
            <Icon name="photo" />
          </Button>
        </div>

        {mode === 'draw' && (
          <>
            <div className={styles.colorPicker}>
              {PREDEFINED_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={buildClassName(
                    styles.colorSwatch,
                    selectedColor === color && styles.selected,
                  )}
                  style={`background-color: ${color}`}
                  onClick={() => setSelectedColor(color)}
                  aria-label={color}
                />
              ))}
            </div>
            <div className={styles.brushSizeWrapper}>
              <RangeSlider
                className={styles.brushSlider}
                min={MIN_BRUSH_SIZE}
                max={MAX_BRUSH_SIZE}
                value={brushSize}
                onChange={setBrushSize}
              />
            </div>
            <div className={styles.drawActions}>
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleUndo}
                disabled={drawActions.length === 0}
                ariaLabel={lang('Undo')}
              >
                <Icon name="arrow-left" />
              </Button>
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleClear}
                disabled={drawActions.length === 0}
                ariaLabel={lang('Clear')}
              >
                <Icon name="delete" />
              </Button>
            </div>
          </>
        )}

        {mode === 'crop' && (
          <div className={styles.zoomWrapper}>
            <Icon name="zoom-out" className={styles.zoomIcon} />
            <RangeSlider
              className={styles.zoomSlider}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              value={zoom}
              onChange={setZoom}
            />
            <Icon name="zoom-in" className={styles.zoomIcon} />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default memo(MediaEditor);
