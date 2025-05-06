import centerSvg from './center.svg';
import { isMobileAndTablet } from './utils/isMobileAndTablet';
import { squaredHypot } from './utils/squaredHypot';

export type Points = {
  position: Vector2;
  yaw?: number;
};

export type PointsLocal = {
  position: Vector2;
  yaw?: number;
  mapPosition: Vector2;
};

export type Vector2 = {
  x: number;
  y: number;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

type MotorTownMapEvent = {
  'mt-map:point-click': CustomEvent<{ index: number }>;
  'mt-map:point-hover': CustomEvent<{ index: number | undefined }>;
};

type MotorTownMapEventKey = keyof MotorTownMapEvent;

const FIT_PADDING = 128;

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface MotorTownMap {
  addEventListener<K extends MotorTownMapEventKey>(
    event: K,
    listener: (this: MotorTownMap, ev: MotorTownMapEvent[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

const MAP_SIZE = 4096;
const MAX_SCALE = 50;
const MIN_SCALE = 0.1;

const SQRT_3 = 1.7320508075688772;

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MotorTownMap extends HTMLElement {
  static observedAttributes = ['track-mode', 'point-color', 'point-selected-color', 'point-hover-color'] as const;

  private trackMode = false;
  private pointColor = '#dfb300';
  private pointSelectedColor = '#002cdf';
  private pointHoverColor: string | undefined;

  private points: PointsLocal[] | undefined = undefined;

  private currentScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  private mapCanvas = document.createElement('canvas');
  private mapCanvasCtx = this.mapCanvas.getContext('2d');
  private mapImage = new Image();
  private mapLoaded = false;

  private recenterButton = document.createElement('button');

  constructor() {
    super();
  }

  private isMobileAndTablet = false;

  private scaled(x: number) {
    return x * (this.isMobileAndTablet ? 1 : window.devicePixelRatio);
  }

  private baseCheckpointRadius = () => this.scaled(7.5);
  private baseCheckpointOutlineRadius = () => this.scaled(1.5);
  private baseArrowLength = () => this.scaled(20);
  private baseArrowHeadLength = () => this.scaled(15);
  private baseConnectingLineWidth = () => this.scaled(3);
  private baseArrowLineWidth = () => this.scaled(3);
  private selectRadius = () => {
    const r = this.baseCheckpointRadius() + this.scaled(3);
    return r * r;
  };

  private selectedIndex: number | undefined = undefined;
  private hoveredIndex: number | undefined = undefined;

  setPoint(points: Points[]) {
    this.points = points.map((point) => ({
      ...point,
      mapPosition: this.transformPoint(point.position),
    }));
  }

  private transformPoint(point: Vector2) {
    const x = point.x,
      y = point.y;
    const xp = ((x + 1280000) / 2200000) * MAP_SIZE;
    const yp = ((y + 320000) / 2200000) * MAP_SIZE;
    return { x: xp, y: yp };
  }

  private getCanvasPosition(point: Vector2) {
    return { x: point.x * this.currentScale + this.offsetX, y: point.y * this.currentScale + this.offsetY };
  }

  private prevMapLoaded: boolean | undefined;
  private prevOffsetX: number | undefined;
  private prevOffsetY: number | undefined;
  private prevCurrentScale: number | undefined;
  private prevMapCanvasWidth: number | undefined;
  private prevMapCanvasHeight: number | undefined;
  private prevPoints: PointsLocal[] | undefined;
  private prevTrackMode: boolean | undefined;
  private prevPointColor: string | undefined;
  private prevPointSelectedColor: string | undefined;
  private prevPointHoverColor: string | undefined;
  private prevSelectedIndex: number | undefined;
  private prevHoveredIndex: number | undefined;

  private stateChange() {
    const changed =
      this.mapLoaded !== this.prevMapLoaded ||
      this.offsetX !== this.prevOffsetX ||
      this.offsetY !== this.prevOffsetY ||
      this.currentScale !== this.prevCurrentScale ||
      this.mapCanvas.width !== this.prevMapCanvasWidth ||
      this.mapCanvas.height !== this.prevMapCanvasHeight ||
      this.points !== this.prevPoints ||
      this.trackMode !== this.prevTrackMode ||
      this.pointColor !== this.prevPointColor ||
      this.pointSelectedColor !== this.prevPointSelectedColor ||
      this.pointHoverColor !== this.prevPointHoverColor ||
      this.selectedIndex !== this.prevSelectedIndex ||
      this.hoveredIndex !== this.prevHoveredIndex;
    if (changed) {
      this.prevMapLoaded = this.mapLoaded;
      this.prevOffsetX = this.offsetX;
      this.prevOffsetY = this.offsetY;
      this.prevCurrentScale = this.currentScale;
      this.prevMapCanvasWidth = this.mapCanvas.width;
      this.prevMapCanvasHeight = this.mapCanvas.height;
      this.prevPoints = this.points;
      this.prevTrackMode = this.trackMode;
      this.prevPointColor = this.pointColor;
      this.prevPointSelectedColor = this.pointSelectedColor;
      this.prevPointHoverColor = this.pointHoverColor;
      this.prevSelectedIndex = this.selectedIndex;
      this.prevHoveredIndex = this.hoveredIndex;
    }
    return changed;
  }

  private animationRequestId: number | undefined;

  private drawMap = () => {
    this.animationRequestId = window.requestAnimationFrame(this.drawMap);
    if (!this.stateChange()) {
      return;
    }
    if (!this.mapCanvasCtx) {
      console.error('mapCanvas not found');
      return;
    }
    this.mapCanvasCtx.fillStyle = ' #375d87';
    this.mapCanvasCtx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);

    // Draw the map image.
    if (this.mapImage && this.mapLoaded) {
      this.mapCanvasCtx.imageSmoothingEnabled = false;
      this.mapCanvasCtx.drawImage(
        this.mapImage,
        this.offsetX,
        this.offsetY,
        MAP_SIZE * this.currentScale,
        MAP_SIZE * this.currentScale,
      );
    }

    if (this.points) {
      // Draw each waypoint with its arrow and label.
      const lineWidth = this.baseCheckpointOutlineRadius();
      const radius = this.baseCheckpointRadius();
      const arrowLength = this.baseArrowLength();
      const arrowHeadLength = this.baseArrowHeadLength();
      const arrowLineLength = this.baseArrowLineWidth();
      const connectingLineWidth = this.baseConnectingLineWidth();
      const arrowBodyLength = (arrowLength * SQRT_3) / 2;

      if (this.trackMode) {
        // Draw connecting polyline.
        const mp0 = this.getCanvasPosition(this.points[0].mapPosition);
        this.mapCanvasCtx.beginPath();
        this.mapCanvasCtx.moveTo(mp0.x, mp0.y);
        for (let i = 1; i < this.points.length; i++) {
          const mp = this.getCanvasPosition(this.points[i].mapPosition);
          this.mapCanvasCtx.lineTo(mp.x, mp.y);
        }
        this.mapCanvasCtx.strokeStyle = 'white';
        this.mapCanvasCtx.lineWidth = connectingLineWidth;
        this.mapCanvasCtx.stroke();
      }

      for (let i = 0; i < this.points.length; i++) {
        const wp = this.points[i];
        const mp = this.getCanvasPosition(wp.mapPosition);
        if (this.trackMode) {
          //draw arrow
          const yaw = wp.yaw ?? 0;
          const dx = arrowLength * Math.cos(yaw);
          const dy = arrowLength * Math.sin(yaw);
          const dxBody = arrowBodyLength * Math.cos(yaw);
          const dyBody = arrowBodyLength * Math.sin(yaw);
          this.mapCanvasCtx.beginPath();
          this.mapCanvasCtx.moveTo(mp.x, mp.y);
          this.mapCanvasCtx.lineTo(mp.x + dxBody, mp.y + dyBody);
          this.mapCanvasCtx.strokeStyle = 'red';
          this.mapCanvasCtx.lineWidth = arrowLineLength;
          this.mapCanvasCtx.stroke();
          const fromX = mp.x;
          const fromY = mp.y;
          const toX = mp.x + dx;
          const toY = mp.y + dy;
          const angle = Math.atan2(toY - fromY, toX - fromX);
          this.mapCanvasCtx.beginPath();
          this.mapCanvasCtx.moveTo(toX, toY);
          this.mapCanvasCtx.lineTo(
            toX - arrowHeadLength * Math.cos(angle - Math.PI / 6),
            toY - arrowHeadLength * Math.sin(angle - Math.PI / 6),
          );
          this.mapCanvasCtx.lineTo(
            toX - arrowHeadLength * Math.cos(angle + Math.PI / 6),
            toY - arrowHeadLength * Math.sin(angle + Math.PI / 6),
          );
          this.mapCanvasCtx.closePath();
          this.mapCanvasCtx.fillStyle = 'red';
          this.mapCanvasCtx.fill();
        }

        this.mapCanvasCtx.beginPath();
        this.mapCanvasCtx.arc(mp.x, mp.y, radius, 0, 2 * Math.PI);
        this.mapCanvasCtx.fillStyle =
          i === this.selectedIndex
            ? this.pointSelectedColor
            : i === this.hoveredIndex && this.pointHoverColor
              ? this.pointHoverColor
              : this.pointColor;
        this.mapCanvasCtx.fill();
        this.mapCanvasCtx.strokeStyle = 'black';
        this.mapCanvasCtx.lineWidth = lineWidth;
        this.mapCanvasCtx.stroke();
      }
    }
  };

  zoomFit() {
    if (!this.mapCanvasCtx) {
      console.error('mapCanvas not found');
      return;
    }

    if (this.trackMode && this.points) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      this.points.forEach((point) => {
        minX = Math.min(point.mapPosition.x, minX);
        minY = Math.min(point.mapPosition.y, minY);
        maxX = Math.max(point.mapPosition.x, maxX);
        maxY = Math.max(point.mapPosition.y, maxY);
      });
      const deltaX = maxX - minX;
      const deltaY = maxY - minY;
      const currentScaleX = (this.mapCanvas.width - FIT_PADDING * 2) / deltaX;
      const currentScaleY = (this.mapCanvas.height - FIT_PADDING * 2) / deltaY;
      if (currentScaleX < currentScaleY) {
        this.currentScale = Math.min(MAX_SCALE, currentScaleX);
        this.offsetX = -minX * this.currentScale + FIT_PADDING;
        const midpointY = (minY + maxY) / 2;
        this.offsetY = -midpointY * this.currentScale + this.mapCanvas.height / 2;
      } else {
        this.currentScale = Math.min(MAX_SCALE, currentScaleY);
        this.offsetY = -minY * this.currentScale + FIT_PADDING;
        const midpointX = (minX + maxX) / 2;
        this.offsetX = -midpointX * this.currentScale + this.mapCanvas.width / 2;
      }
    } else {
      const currentScaleX = this.mapCanvas.width / MAP_SIZE;
      const currentScaleY = this.mapCanvas.height / MAP_SIZE;
      this.currentScale = Math.max(MIN_SCALE, Math.min(currentScaleX, currentScaleY));
      const midpointY = MAP_SIZE / 2;
      this.offsetY = -midpointY * this.currentScale + this.mapCanvas.height / 2;
      const midpointX = MAP_SIZE / 2;
      this.offsetX = -midpointX * this.currentScale + this.mapCanvas.width / 2;
    }

    this.updateRecenterBtn(true);
  }

  private updateRecenterBtn(centered: boolean) {
    if (centered) {
      this.recenterButton.classList.add('recenterBtn--centered');
    } else {
      this.recenterButton.classList.remove('recenterBtn--centered');
    }
  }

  private updateHovered(index: number | undefined) {
    if (this.hoveredIndex !== index) {
      this.hoveredIndex = index;
      const event = new CustomEvent('mt-map:point-hover' as MotorTownMapEventKey, {
        bubbles: false,
        detail: { index: index },
      }) satisfies MotorTownMapEvent['mt-map:point-hover'];

      // Dispatch the event.
      this.dispatchEvent(event);
    }
  }

  private wheelEvent = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.mapCanvas.getBoundingClientRect();
    const mouseX = this.scaled(e.clientX - rect.left);
    const mouseY = this.scaled(e.clientY - rect.top);
    const zoomFactor = Math.sign(e.deltaY) * -0.1;
    const worldX = (mouseX - this.offsetX) / this.currentScale;
    const worldY = (mouseY - this.offsetY) / this.currentScale;
    let nextCurrentScale = this.currentScale * (1 + zoomFactor);
    nextCurrentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextCurrentScale));
    if (nextCurrentScale !== this.currentScale) {
      this.currentScale = nextCurrentScale;
      this.offsetX = mouseX - worldX * this.currentScale;
      this.offsetY = mouseY - worldY * this.currentScale;
      this.updateRecenterBtn(false);
    }
  };

  private mouseMoveEvent = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const rect = this.mapCanvas.getBoundingClientRect();

    const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches[0].clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).touches[0].clientY;

    if (this.isDragging) {
      this.mapCanvas.style.cursor = 'grabbing';
      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top;
      const dx = currentX - this.lastX;
      const dy = currentY - this.lastY;
      this.lastX = currentX;
      this.lastY = currentY;
      this.offsetX += this.scaled(dx);
      this.offsetY += this.scaled(dy);
      this.updateRecenterBtn(false);
      return;
    }

    if (this.points) {
      const hoverX = this.scaled(clientX - rect.left);
      const hoverY = this.scaled(clientY - rect.top);
      const selectRadius = this.selectRadius();

      let hoveredIndex: number | undefined;
      let closest = Infinity;
      for (let i = 0; i < this.points.length; i++) {
        const mp = this.getCanvasPosition(this.points[i].mapPosition);
        const dist = squaredHypot(hoverX - mp.x, hoverY - mp.y);

        if (this.selectedIndex !== i && dist <= selectRadius && dist <= closest) {
          hoveredIndex = i;
          closest = dist;
        }
      }

      this.updateHovered(hoveredIndex);
      if (hoveredIndex !== undefined) {
        this.mapCanvas.style.cursor = 'pointer';
        return;
      }
    }
    this.mapCanvas.style.cursor = 'grab';
  };

  private clickEvent = () => {
    // Only proceed if not dragging.
    if (this.isDragging) return;
    if (this.hoveredIndex === undefined) return;
    this.mapCanvas.style.cursor = 'pointer';

    this.selectedIndex = this.hoveredIndex;

    const event = new CustomEvent('mt-map:point-click' as MotorTownMapEventKey, {
      bubbles: false,
      detail: { index: this.selectedIndex },
    }) satisfies MotorTownMapEvent['mt-map:point-click'];

    // Dispatch the event.
    this.dispatchEvent(event);
  };

  private mouseDownEvent = (e: MouseEvent | TouchEvent) => {
    this.isDragging = true;

    const rect = this.mapCanvas.getBoundingClientRect();
    const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches[0].clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).touches[0].clientY;
    this.lastX = clientX - rect.left;
    this.lastY = clientY - rect.top;
  };

  private mouseUpEvent = () => {
    this.isDragging = false;
  };

  private resizeEvent = () => {
    const canvasBound = this.mapCanvas.getBoundingClientRect();
    this.mapCanvas.width = this.scaled(canvasBound.width);
    this.mapCanvas.height = this.scaled(canvasBound.height);
    this.updateRecenterBtn(false);
  };

  private recenterClick = () => {
    this.zoomFit();
  };

  protected connectedCallback() {
    this.isMobileAndTablet = isMobileAndTablet();
    const shadow = this.attachShadow({ mode: 'open' });

    this.mapImage.onload = () => {
      this.mapLoaded = true;
    };
    this.mapImage.src = 'map.png';

    this.mapCanvas.addEventListener('wheel', this.wheelEvent, {
      passive: false,
    });
    this.mapCanvas.addEventListener('mousemove', this.mouseMoveEvent, {
      passive: false,
    });
    this.mapCanvas.addEventListener('touchmove', this.mouseMoveEvent, {
      passive: false,
    });
    this.mapCanvas.addEventListener('click', this.clickEvent, {
      passive: true,
    });
    this.mapCanvas.addEventListener('mousedown', this.mouseDownEvent, {
      passive: true,
    });
    this.mapCanvas.addEventListener('touchstart', this.mouseDownEvent, {
      passive: true,
    });
    this.mapCanvas.addEventListener('mouseup', this.mouseUpEvent, {
      passive: true,
    });
    this.mapCanvas.addEventListener('mouseleave', this.mouseUpEvent, {
      passive: true,
    });
    this.mapCanvas.addEventListener('touchend', this.mouseUpEvent, {
      passive: true,
    });
    window.addEventListener('resize', this.resizeEvent, {
      passive: true,
    });
    this.recenterButton.addEventListener('click', this.recenterClick, {
      passive: true,
    });

    this.recenterButton.innerHTML = centerSvg;
    this.recenterButton.type = 'button';
    this.recenterButton.className = 'recenterBtn recenterBtn--centered';

    const sheet = new CSSStyleSheet();
    sheet.insertRule('canvas { width: 100%; height: 100%; }');
    sheet.insertRule(
      '.recenterBtn { display: flex; position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); border: none; padding: 4px; border-radius: 4px; cursor: pointer; }',
    );
    sheet.insertRule('.recenterBtn.recenterBtn--centered { display: none; }');

    shadow.adoptedStyleSheets = [sheet];
    shadow.appendChild(this.recenterButton);
    shadow.appendChild(this.mapCanvas);
    const canvasBound = this.mapCanvas.getBoundingClientRect();
    this.mapCanvas.width = this.scaled(canvasBound.width);
    this.mapCanvas.height = this.scaled(canvasBound.height);
    this.zoomFit();
    window.requestAnimationFrame(this.drawMap);
  }

  disconnectedCallback() {
    this.mapCanvas.removeEventListener('wheel', this.wheelEvent);
    this.mapCanvas.removeEventListener('mousemove', this.mouseMoveEvent);
    this.mapCanvas.removeEventListener('touchmove', this.mouseMoveEvent);
    this.mapCanvas.removeEventListener('click', this.clickEvent);
    this.mapCanvas.removeEventListener('mousedown', this.mouseDownEvent);
    this.mapCanvas.removeEventListener('touchstart', this.mouseDownEvent);
    this.mapCanvas.removeEventListener('mouseup', this.mouseUpEvent);
    this.mapCanvas.removeEventListener('mouseleave', this.mouseUpEvent);
    this.mapCanvas.removeEventListener('touchend', this.mouseUpEvent);
    this.recenterButton.removeEventListener('click', this.recenterClick);
    window.removeEventListener('resize', this.resizeEvent);
    if (this.animationRequestId !== undefined) {
      window.cancelAnimationFrame(this.animationRequestId);
    }
  }

  attributeChangedCallback(name: (typeof MotorTownMap.observedAttributes)[number], _: string, newValue: string) {
    switch (name) {
      case 'track-mode': {
        const v = newValue.trim();
        this.trackMode = v !== '0' && v !== 'false';
        break;
      }
      case 'point-color': {
        const v = newValue.trim();
        this.pointColor = v;
        break;
      }
      case 'point-selected-color': {
        const v = newValue.trim();
        this.pointSelectedColor = v;
        break;
      }
      case 'point-hover-color': {
        const v = newValue.trim();
        this.pointHoverColor = v;
        break;
      }
    }
  }
}

customElements.define('mt-map', MotorTownMap);
