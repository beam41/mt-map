import centerSvg from './center.svg';
import rangeSvg from './range.svg';
import zoomInSvg from './zoomIn.svg';
import zoomOutSvg from './zoomOut.svg';
import { squaredHypot } from './utils/squaredHypot';
import { rotatePoints } from './utils/rotatePoints';

export type PointLocal = {
  position: Vector2;
  yaw?: number;
  scaleY?: number;
  mapPosition: Vector2;
  color?: {
    point?: string;
    selected?: string;
    hover?: string;
  };
};

export type Point = Omit<PointLocal, 'mapPosition'>;

export type PointSelected = Omit<PointLocal, 'position'>;

export type Vector2 = {
  x: number;
  y: number;
};

type MotorTownMapEvent = {
  'mt-map:point-click': CustomEvent<{ index: number }>;
  'mt-map:point-hover': CustomEvent<{ index: number | undefined }>;
  'mt-map:point-move': CustomEvent<{ index: number; position: Vector2 }>;
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
const MAP_REAL_X_LEFT = -1280000;
const MAP_REAL_Y_TOP = -320000;
const MAP_REAL_SIZE = 2200000;
const MAX_SCALE = 50;
const MIN_SCALE = 0.1;

const ROAD_OFFSET_X = -1;
const ROAD_OFFSET_Y = 175;
const ROAD_SCALE = 0.8156;
const ROAD_SIZE = MAP_SIZE * ROAD_SCALE;

function copyPointSelected(point: PointSelected): PointSelected {
  return {
    mapPosition: {
      x: point.mapPosition.x,
      y: point.mapPosition.y,
    },
    scaleY: point.scaleY,
    yaw: point.yaw,
  };
}

function transformPoint(point: Vector2) {
  return {
    x: ((point.x - MAP_REAL_X_LEFT) / MAP_REAL_SIZE) * MAP_SIZE,
    y: ((point.y - MAP_REAL_Y_TOP) / MAP_REAL_SIZE) * MAP_SIZE,
  };
}

function unTransformPoint(point: Vector2) {
  return {
    x: (point.x / MAP_SIZE) * MAP_REAL_SIZE + MAP_REAL_X_LEFT,
    y: (point.y / MAP_SIZE) * MAP_REAL_SIZE + MAP_REAL_Y_TOP,
  };
}

function scaled(x: number) {
  return x * (window.devicePixelRatio > 2 ? 1 : window.devicePixelRatio);
}

const baseCheckpointRadius = () => scaled(7.5);
const baseCheckpointOutlineRadius = () => scaled(1.5);
const baseArrowLength = () => scaled(20);
const baseArrowHeadLength = () => scaled(15);
const baseConnectingLineWidth = () => scaled(3);
const baseWpLength = () => scaled(0.2);
const baseSelectRadius = () => {
  const r = baseCheckpointRadius() + scaled(3);
  return r * r;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MotorTownMap extends HTMLElement {
  protected static observedAttributes = [
    'track-mode',
    'point-color',
    'point-selected-color',
    'point-hover-color',
  ] as const;

  private trackMode = false;
  private pointColor = '#dfb300';
  private pointSelectedColor = '#002cdf';
  private pointHoverColor: string | undefined;

  private points: PointLocal[] | undefined = undefined;

  private showWpWidth = false;
  private currentScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private isDragging = false;
  private isPointDragging = false;
  private lastX = 0;
  private lastY = 0;

  private mapCanvas = document.createElement('canvas');
  private mapCanvasCtx = this.mapCanvas.getContext('2d');
  private mapImage = new Image();
  private mapLoaded = false;
  private roadImage = new Image();
  private roadLoaded = false;

  private recenterButton = document.createElement('button');
  private showWpWidthButton = document.createElement('button');
  private zoomInButton = document.createElement('button');
  private zoomOutButton = document.createElement('button');

  constructor() {
    super();
  }

  private selectedIndexPoint: PointSelected | undefined = undefined;
  private selectedIndex: number | undefined = undefined;
  private hoveredIndex: number | undefined = undefined;

  setPoints(points: Point[], reset = false) {
    this.points = points.map((point) => ({
      ...point,
      mapPosition: transformPoint(point.position),
    }));
    if (reset) {
      this.selectedIndex = undefined;
      this.selectedIndexPoint = undefined;
    }
    if (this.selectedIndex !== undefined) {
      this.selectedIndexPoint = copyPointSelected(this.points[this.selectedIndex]);
    }
  }

  setSelectedPointYaw(yaw: number) {
    if (this.selectedIndexPoint) {
      this.selectedIndexPoint.yaw = yaw;
    }
  }

  setSelectedPointsScaleY(scaleY: number) {
    if (this.selectedIndexPoint) {
      this.selectedIndexPoint.scaleY = scaleY;
    }
  }

  setSelectedPointsPosition(pos: Vector2) {
    if (this.selectedIndexPoint) {
      this.selectedIndexPoint.mapPosition = transformPoint(pos);
    }
  }

  private getCanvasPosition(point: Vector2) {
    return { x: point.x * this.currentScale + this.offsetX, y: point.y * this.currentScale + this.offsetY };
  }

  private prevMapLoaded: boolean | undefined;
  private prevRoadLoaded: boolean | undefined;
  private prevOffsetX: number | undefined;
  private prevOffsetY: number | undefined;
  private prevCurrentScale: number | undefined;
  private prevMapCanvasWidth: number | undefined;
  private prevMapCanvasHeight: number | undefined;
  private prevPoints: PointLocal[] | undefined;
  private prevTrackMode: boolean | undefined;
  private prevPointColor: string | undefined;
  private prevPointSelectedColor: string | undefined;
  private prevPointHoverColor: string | undefined;
  private prevSelectedIndex: number | undefined;
  private prevHoveredIndex: number | undefined;
  private prevShowWpWidth: boolean | undefined;

  private prevSelectedIndexPointScaleY: number | undefined;
  private prevSelectedIndexPointYaw: number | undefined;
  private prevSelectedIndexPointPositionX: number | undefined;
  private prevSelectedIndexPointPositionY: number | undefined;

  private stateChange() {
    const changed =
      this.mapLoaded !== this.prevMapLoaded ||
      this.roadLoaded !== this.prevRoadLoaded ||
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
      this.hoveredIndex !== this.prevHoveredIndex ||
      this.showWpWidth !== this.prevShowWpWidth ||
      this.selectedIndexPoint?.scaleY !== this.prevSelectedIndexPointScaleY ||
      this.selectedIndexPoint?.yaw !== this.prevSelectedIndexPointYaw ||
      this.selectedIndexPoint?.mapPosition.x !== this.prevSelectedIndexPointPositionX ||
      this.selectedIndexPoint?.mapPosition.y !== this.prevSelectedIndexPointPositionY;
    if (changed) {
      this.prevMapLoaded = this.mapLoaded;
      this.prevRoadLoaded = this.roadLoaded;
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
      this.prevShowWpWidth = this.showWpWidth;
      this.prevSelectedIndexPointScaleY = this.selectedIndexPoint?.scaleY;
      this.prevSelectedIndexPointYaw = this.selectedIndexPoint?.yaw;
      this.prevSelectedIndexPointPositionX = this.selectedIndexPoint?.mapPosition.x;
      this.prevSelectedIndexPointPositionY = this.selectedIndexPoint?.mapPosition.y;
    }
    return changed;
  }

  private animationRequestId: number | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private drawMap = (_: number, force?: boolean) => {
    if (!force) {
      this.animationRequestId = window.requestAnimationFrame(this.drawMap);
    }

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
    if (this.mapLoaded) {
      this.mapCanvasCtx.imageSmoothingEnabled = false;
      this.mapCanvasCtx.drawImage(
        this.mapImage,
        this.offsetX,
        this.offsetY,
        MAP_SIZE * this.currentScale,
        MAP_SIZE * this.currentScale,
      );
    }

    if (this.roadLoaded) {
      this.mapCanvasCtx.globalAlpha = 0.4;
      this.mapCanvasCtx.imageSmoothingEnabled = true;
      this.mapCanvasCtx.drawImage(
        this.roadImage,
        this.offsetX + (MAP_SIZE / 2 - ROAD_SIZE / 2 - ROAD_OFFSET_X) * this.currentScale,
        this.offsetY + (MAP_SIZE / 2 - ROAD_SIZE / 2 - ROAD_OFFSET_Y) * this.currentScale,
        ROAD_SIZE * this.currentScale,
        ROAD_SIZE * this.currentScale,
      );
      this.mapCanvasCtx.globalAlpha = 1;
    }

    if (this.points) {
      // Draw each waypoint with its arrow and label.
      const lineWidth = baseCheckpointOutlineRadius();
      const radius = baseCheckpointRadius();
      const arrowLength = baseArrowLength();
      const arrowHeadLength = baseArrowHeadLength();
      const connectingLineWidth = baseConnectingLineWidth();
      const wpLength = baseWpLength();

      if (this.trackMode) {
        // Draw connecting polyline.
        const mp0 = this.getCanvasPosition(this.points[0].mapPosition);
        this.mapCanvasCtx.beginPath();
        this.mapCanvasCtx.moveTo(mp0.x, mp0.y);
        for (let i = 1; i < this.points.length; i++) {
          const mp = this.getCanvasPosition(this.points[i].mapPosition);
          this.mapCanvasCtx.lineTo(mp.x, mp.y);
        }
        this.mapCanvasCtx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.mapCanvasCtx.lineWidth = connectingLineWidth;
        this.mapCanvasCtx.stroke();
      }

      for (let i = 0; i < this.points.length; i++) {
        const wp = this.points[i];
        const mp = this.getCanvasPosition(wp.mapPosition);
        const selectedColor = wp.color?.selected || this.pointSelectedColor;
        const pointColor = wp.color?.point || this.pointColor;
        const hoverColor = wp.color?.hover || this.pointHoverColor;
        const fillStyle =
          i === this.selectedIndex
            ? selectedColor
            : i === this.hoveredIndex && hoverColor
              ? hoverColor
              : this.showWpWidth
                ? 'yellow'
                : pointColor;
        if (this.trackMode && this.selectedIndex === i) {
          this.mapCanvasCtx.globalAlpha = 0.6;
        }
        this.drawPoint(wp, mp, fillStyle, lineWidth, radius, arrowHeadLength, wpLength, arrowLength);
        this.mapCanvasCtx.globalAlpha = 1;
      }

      if (this.trackMode && this.selectedIndex !== undefined && this.selectedIndexPoint) {
        const wp = this.selectedIndexPoint;
        const mp = this.getCanvasPosition(this.selectedIndexPoint!.mapPosition);
        this.drawPoint(
          wp,
          mp,
          wp.color?.selected || this.pointSelectedColor,
          lineWidth,
          radius,
          arrowHeadLength,
          wpLength,
          arrowLength,
        );
      }
    }
  };

  private drawPoint(
    wp: Pick<PointLocal, 'yaw' | 'scaleY'>,
    mp: Vector2,
    fillStyle: string,
    lineWidth: number,
    radius: number,
    arrowHeadLength: number,
    wpLength: number,
    arrowLength: number,
  ) {
    if (this.trackMode) {
      if (this.showWpWidth) {
        const yaw = wp.yaw ?? 0;
        const scaleY = (((wp.scaleY ?? 0) * 100) / MAP_REAL_SIZE) * MAP_SIZE * this.currentScale;
        const [p1, p2] = rotatePoints(
          {
            x: mp.x,
            y: mp.y - scaleY / 2,
          },
          {
            x: mp.x,
            y: mp.y + scaleY / 2,
          },
          yaw,
        );
        this.mapCanvasCtx!.beginPath();
        this.mapCanvasCtx!.moveTo(p1.x, p1.y);
        this.mapCanvasCtx!.lineTo(p2.x, p2.y);
        this.mapCanvasCtx!.strokeStyle = fillStyle;
        this.mapCanvasCtx!.lineWidth = wpLength * this.currentScale;
        this.mapCanvasCtx!.stroke();
      } else {
        //draw arrow
        const yaw = wp.yaw ?? 0;
        const dx = arrowLength * Math.cos(yaw);
        const dy = arrowLength * Math.sin(yaw);
        const fromX = mp.x;
        const fromY = mp.y;
        const toX = mp.x + dx;
        const toY = mp.y + dy;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        this.mapCanvasCtx!.beginPath();
        this.mapCanvasCtx!.moveTo(toX, toY);
        this.mapCanvasCtx!.lineTo(
          toX - arrowHeadLength * Math.cos(angle - Math.PI / 6),
          toY - arrowHeadLength * Math.sin(angle - Math.PI / 6),
        );
        this.mapCanvasCtx!.lineTo(
          toX - arrowHeadLength * Math.cos(angle + Math.PI / 6),
          toY - arrowHeadLength * Math.sin(angle + Math.PI / 6),
        );
        this.mapCanvasCtx!.closePath();
        this.mapCanvasCtx!.fillStyle = 'red';
        this.mapCanvasCtx!.fill();
      }
    }

    if (!this.trackMode || !this.showWpWidth) {
      this.mapCanvasCtx!.beginPath();
      this.mapCanvasCtx!.arc(mp.x, mp.y, radius, 0, 2 * Math.PI);
      this.mapCanvasCtx!.fillStyle = fillStyle;
      this.mapCanvasCtx!.fill();
      this.mapCanvasCtx!.strokeStyle = 'black';
      this.mapCanvasCtx!.lineWidth = lineWidth;
      this.mapCanvasCtx!.stroke();
    }
  }

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
      this.recenterButton.classList.add('btn--hide');
    } else {
      this.recenterButton.classList.remove('btn--hide');
    }
  }

  private updateHovered(index: number | undefined) {
    if (this.hoveredIndex !== index) {
      this.hoveredIndex = index;
      const event = new CustomEvent('mt-map:point-hover', {
        bubbles: false,
        detail: { index: index },
      }) satisfies MotorTownMapEvent['mt-map:point-hover'];
      this.dispatchEvent(event);
    }
  }

  private wheelEvent = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.mapCanvas.getBoundingClientRect();
    const mouseX = scaled(e.clientX - rect.left);
    const mouseY = scaled(e.clientY - rect.top);
    const zoomFactor = Math.sign(e.deltaY) * -0.1;
    this.doZoom(zoomFactor, mouseX, mouseY);
  };

  private doZoom = (zoomFactor: number, zoomCenterX: number, zoomCenterY: number) => {
    const worldX = (zoomCenterX - this.offsetX) / this.currentScale;
    const worldY = (zoomCenterY - this.offsetY) / this.currentScale;
    let nextCurrentScale = this.currentScale * (1 + zoomFactor);
    nextCurrentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextCurrentScale));
    if (nextCurrentScale !== this.currentScale) {
      this.currentScale = nextCurrentScale;
      this.offsetX = zoomCenterX - worldX * this.currentScale;
      this.offsetY = zoomCenterY - worldY * this.currentScale;
      this.updateRecenterBtn(false);
    }
  };

  private zoomInClick = () => {
    const rect = this.mapCanvas.getBoundingClientRect();
    const centerX = scaled(rect.width / 2);
    const centerY = scaled(rect.height / 2);
    this.doZoom(0.2, centerX, centerY);
  };

  private zoomOutClick = () => {
    const rect = this.mapCanvas.getBoundingClientRect();
    const centerX = scaled(rect.width / 2);
    const centerY = scaled(rect.height / 2);
    this.doZoom(-0.2, centerX, centerY);
  };

  private mouseMoveEvent = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const rect = this.mapCanvas.getBoundingClientRect();

    const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches[0].clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).touches[0].clientY;
    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    if (this.isPointDragging && this.selectedIndex !== undefined && this.selectedIndexPoint) {
      this.selectedIndexPoint.mapPosition.x = (scaled(currentX) - this.offsetX) / this.currentScale;
      this.selectedIndexPoint.mapPosition.y = (scaled(currentY) - this.offsetY) / this.currentScale;

      const event = new CustomEvent('mt-map:point-move', {
        bubbles: false,
        detail: { index: this.selectedIndex, position: unTransformPoint(this.selectedIndexPoint.mapPosition) },
      }) satisfies MotorTownMapEvent['mt-map:point-move'];
      this.dispatchEvent(event);

      return;
    }

    if (this.isDragging) {
      this.mapCanvas.style.cursor = 'grabbing';
      const dx = currentX - this.lastX;
      const dy = currentY - this.lastY;
      this.lastX = currentX;
      this.lastY = currentY;
      this.offsetX += scaled(dx);
      this.offsetY += scaled(dy);
      this.updateRecenterBtn(false);
      return;
    }

    if (this.points) {
      const hoverX = scaled(currentX);
      const hoverY = scaled(currentY);
      const selectRadius = baseSelectRadius();

      let hoveredIndex: number | undefined;
      let closest = Infinity;
      for (let i = 0; i < this.points.length; i++) {
        const mp = this.getCanvasPosition(
          this.selectedIndex === i ? this.selectedIndexPoint!.mapPosition : this.points[i].mapPosition,
        );
        const dist = squaredHypot(hoverX - mp.x, hoverY - mp.y);

        if (dist <= selectRadius && dist <= closest) {
          hoveredIndex = i;
          closest = dist;
        }
      }

      this.updateHovered(hoveredIndex);
      if (hoveredIndex !== undefined) {
        if (this.trackMode && hoveredIndex === this.selectedIndex) {
          this.mapCanvas.style.cursor = 'move';
        } else {
          this.mapCanvas.style.cursor = 'pointer';
        }

        return;
      }
    }
    this.mapCanvas.style.cursor = 'grab';
  };

  private clickEvent = () => {
    // Only proceed if not dragging.
    if (this.isDragging) return;
    if (!this.points || this.hoveredIndex === undefined || this.selectedIndex === this.hoveredIndex) return;
    this.mapCanvas.style.cursor = 'pointer';

    this.selectedIndex = this.hoveredIndex;
    this.selectedIndexPoint = copyPointSelected(this.points[this.selectedIndex]);

    const event = new CustomEvent('mt-map:point-click', {
      bubbles: false,
      detail: { index: this.selectedIndex },
    }) satisfies MotorTownMapEvent['mt-map:point-click'];
    this.dispatchEvent(event);
  };

  private mouseDownEvent = (e: MouseEvent | TouchEvent) => {
    this.isDragging = true;

    const rect = this.mapCanvas.getBoundingClientRect();
    const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches[0].clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).touches[0].clientY;

    if (this.points && this.selectedIndexPoint) {
      const currentX = scaled(clientX - rect.left);
      const currentY = scaled(clientY - rect.top);
      const selectRadius = baseSelectRadius();

      const mp = this.getCanvasPosition(this.selectedIndexPoint.mapPosition);
      const dist = squaredHypot(currentX - mp.x, currentY - mp.y);

      if (dist <= selectRadius) {
        this.isPointDragging = true;
      }
    }

    this.lastX = clientX - rect.left;
    this.lastY = clientY - rect.top;
  };

  private mouseUpEvent = () => {
    this.isDragging = false;
    this.isPointDragging = false;
  };

  private resizeEvent = () => {
    const canvasBound = this.mapCanvas.getBoundingClientRect();
    this.mapCanvas.width = scaled(canvasBound.width);
    this.mapCanvas.height = scaled(canvasBound.height);
    this.updateRecenterBtn(false);
    this.drawMap(0, true);
  };

  private recenterClick = () => {
    this.zoomFit();
  };

  private showWpWidthClick = () => {
    this.showWpWidth = !this.showWpWidth;
  };

  private resizeObserver: ResizeObserver | undefined;

  protected connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    this.mapImage.onload = () => {
      this.mapLoaded = true;
    };
    this.mapImage.src = 'map.png';

    this.roadImage.onload = () => {
      this.roadLoaded = true;
    };
    this.roadImage.src = `road.svg`;

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
    this.recenterButton.addEventListener('click', this.recenterClick, {
      passive: true,
    });
    this.showWpWidthButton.addEventListener('click', this.showWpWidthClick, {
      passive: true,
    });
    this.zoomInButton.addEventListener('click', this.zoomInClick, {
      passive: true,
    });
    this.zoomOutButton.addEventListener('click', this.zoomOutClick, {
      passive: true,
    });

    this.resizeObserver = new ResizeObserver(this.resizeEvent);
    this.resizeObserver.observe(this);

    this.recenterButton.innerHTML = centerSvg;
    this.recenterButton.type = 'button';
    this.recenterButton.className = 'btn centerBtn btn--hide';

    this.showWpWidthButton.innerHTML = rangeSvg;
    this.showWpWidthButton.type = 'button';
    this.showWpWidthButton.className = 'btn wpWidthBtn btn--hide';

    this.zoomInButton.innerHTML = zoomInSvg;
    this.zoomInButton.type = 'button';
    this.zoomInButton.className = 'btn zoomInBtn';
    this.zoomOutButton.innerHTML = zoomOutSvg;
    this.zoomOutButton.type = 'button';
    this.zoomOutButton.className = 'btn zoomOutBtn';

    const sheet = new CSSStyleSheet();
    sheet.insertRule(':host { position: relative; }');
    sheet.insertRule('canvas { width: 100%; height: 100%; }');
    sheet.insertRule(
      '.btn { display: flex; position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); border: none; padding: 4px; border-radius: 4px; cursor: pointer; }',
    );
    sheet.insertRule('.btn.zoomInBtn { bottom: 48px; }');
    sheet.insertRule('.btn.centerBtn { bottom: 88px; }');
    sheet.insertRule('.btn.wpWidthBtn { right: 48px; }');
    sheet.insertRule('.btn--hide { display: none !important; }');

    shadow.adoptedStyleSheets = [sheet];
    shadow.appendChild(this.zoomInButton);
    shadow.appendChild(this.zoomOutButton);
    shadow.appendChild(this.recenterButton);
    shadow.appendChild(this.showWpWidthButton);
    shadow.appendChild(this.mapCanvas);
    const canvasBound = this.mapCanvas.getBoundingClientRect();
    this.mapCanvas.width = scaled(canvasBound.width);
    this.mapCanvas.height = scaled(canvasBound.height);
    this.zoomFit();
    window.requestAnimationFrame(this.drawMap);
  }

  protected disconnectedCallback() {
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
    this.showWpWidthButton.removeEventListener('click', this.showWpWidthClick);
    this.zoomInButton.removeEventListener('click', this.zoomInClick);
    this.zoomOutButton.removeEventListener('click', this.zoomOutClick);
    this.resizeObserver?.disconnect();
    if (this.animationRequestId !== undefined) {
      window.cancelAnimationFrame(this.animationRequestId);
    }
  }

  protected attributeChangedCallback(
    name: (typeof MotorTownMap.observedAttributes)[number],
    _: string,
    newValue: string,
  ) {
    switch (name) {
      case 'track-mode': {
        const v = newValue.trim();
        this.trackMode = v !== '0' && v !== 'false';
        if (this.trackMode) {
          this.showWpWidthButton.classList.remove('btn--hide');
        } else {
          this.showWpWidthButton.classList.add('btn--hide');
        }
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
