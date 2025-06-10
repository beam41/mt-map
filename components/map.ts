import centerSvg from './center.svg';
import rangeSvg from './range.svg';
import zoomInSvg from './zoomIn.svg';
import zoomOutSvg from './zoomOut.svg';
import { squaredHypot } from './utils/squaredHypot';
import { rotatePoints } from './utils/rotatePoints';

export type Color = {
  point?: string;
  selected?: string;
  hover?: string;
  outline?: string;
  label?: string;
  labelOutline?: string;
  arrowColor?: string;
  gate?: string;
  gateSelected?: string;
  gateHover?: string;
};

export type ColorLine = { line?: string };

export type GroupColor = Color & ColorLine;

export type PointBase = {
  position: Vector2;
  yaw?: number;
  scaleY?: number;
  mapPosition: Vector2;
  color?: Color;
  label?: string;
};

export type PointsGroupTrackMode =
  | {
      trackMode: true;
      forceShowGate?: boolean;
    }
  | { trackMode?: false };

export type PointsGroupBase<T> = {
  points: T[];
  color?: GroupColor;
  draggable?: boolean;
  hidden?: boolean;
  hoverable?: boolean;
  selectable?: boolean;
} & PointsGroupTrackMode;

export type PointLocal = PointBase & { color: Required<Color> };

export type PointsLocalGroup = Required<
  Omit<PointsGroupBase<PointLocal>, 'color' | 'hidden'> & {
    lineColor?: string;
  } & Pick<Required<PointsGroupTrackMode> & { forceShowGate: boolean }, 'trackMode' | 'forceShowGate'>
>;

export type PointsLocalGroups = Record<string, PointsLocalGroup>;

export type Point = Omit<PointBase, 'mapPosition'>;
export type PointsGroup = PointsGroupBase<Point>;
export type PointsGroups = Record<string, PointsGroup>;

type PointSelected = Omit<PointLocal, 'position'>;

export type Vector2 = {
  x: number;
  y: number;
};

export type MotorTownMapEvent = {
  'mt-map:point-click': CustomEvent<{ id: string; index: number }>;
  'mt-map:point-hover': CustomEvent<{ id: undefined; index: undefined } | { id: string; index: number }>;
  'mt-map:point-move': CustomEvent<{ id: string; index: number; position: Vector2 }>;
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
  removeEventListener<K extends MotorTownMapEventKey>(
    event: K,
    listener: (this: MotorTownMap, ev: MotorTownMapEvent[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
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
    color: {
      hover: point.color.hover,
      selected: point.color.selected,
      point: point.color.point,
      arrowColor: point.color.arrowColor,
      outline: point.color.outline,
      label: point.color.label,
      labelOutline: point.color.labelOutline,
      gate: point.color.gate,
      gateSelected: point.color.gateSelected,
      gateHover: point.color.gateHover,
    },
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
  return x * (window.devicePixelRatio > 2 ? window.devicePixelRatio / 2 : window.devicePixelRatio);
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

// Individual color variables
const pointDefaultHover = '#fff';
const pointDefaultPoint = '#fff';
const pointDefaultSelected = '#fff';
const pointDefaultArrowColor = '#F44336';
const pointDefaultOutline = '#212121';
const pointDefaultLabel = '#fff';
const pointDefaultLabelOutline = '#212121';
const pointDefaultGate = '#FDD835';
const pointDefaultGateSelected = '#FFEE58';
const pointDefaultGateHover = '#F57F17';
const pointDefaultLine = 'rgba(255,255,255,0.3)';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MotorTownMap extends HTMLElement {
  static readonly observedAttributes = ['map', 'road'] as const;

  private groups: PointsLocalGroups = {};

  private hasTrack: boolean = false;
  private hasOneTrackOnly: boolean = false;

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

  private selectedPoint: PointSelected | undefined = undefined;
  private selectedIndex: [string, number] | undefined = undefined;
  private hoveredIndex: [string, number] | undefined = undefined;

  setPoints(groups: PointsGroups, reset = false) {
    this.groups = {};
    this.hasTrack = false;
    let trackCount = 0;
    let hasNotForceShowGate = false;
    Object.entries(groups).forEach(([id, group]) => {
      if (group.hidden) return;

      if (group.trackMode) {
        this.hasTrack = true;
        if (!group.forceShowGate) {
          hasNotForceShowGate = true;
        }
        trackCount++;
      }

      this.groups[id] = {
        points: group.points.map((point) => ({
          ...point,
          mapPosition: transformPoint(point.position),
          color: {
            point: point.color?.point ?? group.color?.point ?? pointDefaultPoint,
            hover: point.color?.hover ?? group.color?.hover ?? pointDefaultHover,
            selected: point.color?.selected ?? group.color?.selected ?? pointDefaultSelected,
            arrowColor: point.color?.arrowColor ?? group.color?.arrowColor ?? pointDefaultArrowColor,
            outline: point.color?.outline ?? group.color?.outline ?? pointDefaultOutline,
            label: point.color?.label ?? group.color?.label ?? pointDefaultLabel,
            labelOutline: point.color?.labelOutline ?? group.color?.labelOutline ?? pointDefaultLabelOutline,
            gate: point.color?.gate ?? group.color?.gate ?? pointDefaultGate,
            gateSelected: point.color?.gateSelected ?? group.color?.gateSelected ?? pointDefaultGateSelected,
            gateHover: point.color?.gateHover ?? group.color?.gateHover ?? pointDefaultGateHover,
          },
        })),
        trackMode: group.trackMode ?? false,
        draggable: group.draggable ?? false,
        lineColor: group.color?.line ?? pointDefaultLine,
        forceShowGate: (group.trackMode && group.forceShowGate) ?? false,
        hoverable: group.hoverable ?? true,
        selectable: group.selectable ?? true,
      };
    });
    this.hasOneTrackOnly = trackCount === 1;

    if (hasNotForceShowGate) {
      this.showWpWidthButton.classList.remove('btn--hide');
    } else {
      this.showWpWidthButton.classList.add('btn--hide');
    }

    if (reset) {
      this.selectedIndex = undefined;
      this.selectedPoint = undefined;
    }
    if (this.selectedIndex !== undefined) {
      const [group, index] = this.selectedIndex;
      this.selectedPoint = copyPointSelected(this.groups[group].points[index]);
    }
  }

  setSelectedIndex(id: string | undefined, index: number | undefined) {
    this.selectedIndex = id !== undefined && index !== undefined ? [id, index] : undefined;
    if (this.selectedIndex !== undefined) {
      const [group, index] = this.selectedIndex;
      this.selectedPoint = copyPointSelected(this.groups[group].points[index]);
    }
  }

  setSelectedPointYaw(yaw: number) {
    if (this.selectedPoint) {
      this.selectedPoint.yaw = yaw;
    }
  }

  setSelectedPointScaleY(scaleY: number) {
    if (this.selectedPoint) {
      this.selectedPoint.scaleY = scaleY;
    }
  }

  setSelectedPointPosition(pos: Vector2) {
    if (this.selectedPoint) {
      this.selectedPoint.mapPosition = transformPoint(pos);
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
  private prevGroups: PointsLocalGroups | undefined;
  private prevSelectedIndex: [string, number] | undefined;
  private prevHoveredIndex: [string, number] | undefined;
  private prevShowWpWidth: boolean | undefined;

  private prevSelectedPointScaleY: number | undefined;
  private prevSelectedPointYaw: number | undefined;
  private prevSelectedPointPositionX: number | undefined;
  private prevSelectedPointPositionY: number | undefined;

  private stateChange() {
    const changed =
      this.mapLoaded !== this.prevMapLoaded ||
      this.roadLoaded !== this.prevRoadLoaded ||
      this.offsetX !== this.prevOffsetX ||
      this.offsetY !== this.prevOffsetY ||
      this.currentScale !== this.prevCurrentScale ||
      this.mapCanvas.width !== this.prevMapCanvasWidth ||
      this.mapCanvas.height !== this.prevMapCanvasHeight ||
      this.groups !== this.prevGroups ||
      this.selectedIndex !== this.prevSelectedIndex ||
      this.hoveredIndex !== this.prevHoveredIndex ||
      this.showWpWidth !== this.prevShowWpWidth ||
      this.selectedPoint?.scaleY !== this.prevSelectedPointScaleY ||
      this.selectedPoint?.yaw !== this.prevSelectedPointYaw ||
      this.selectedPoint?.mapPosition.x !== this.prevSelectedPointPositionX ||
      this.selectedPoint?.mapPosition.y !== this.prevSelectedPointPositionY;
    if (changed) {
      this.prevMapLoaded = this.mapLoaded;
      this.prevRoadLoaded = this.roadLoaded;
      this.prevOffsetX = this.offsetX;
      this.prevOffsetY = this.offsetY;
      this.prevCurrentScale = this.currentScale;
      this.prevMapCanvasWidth = this.mapCanvas.width;
      this.prevMapCanvasHeight = this.mapCanvas.height;
      this.prevGroups = this.groups;
      this.prevSelectedIndex = this.selectedIndex;
      this.prevHoveredIndex = this.hoveredIndex;
      this.prevShowWpWidth = this.showWpWidth;
      this.prevSelectedPointScaleY = this.selectedPoint?.scaleY;
      this.prevSelectedPointYaw = this.selectedPoint?.yaw;
      this.prevSelectedPointPositionX = this.selectedPoint?.mapPosition.x;
      this.prevSelectedPointPositionY = this.selectedPoint?.mapPosition.y;
    }
    return changed;
  }

  private animationRequestId: number | undefined;

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
    this.mapCanvasCtx.lineJoin = 'round';
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

    if (this.groups) {
      // Draw each waypoint with its arrow and label.
      const lineWidth = baseCheckpointOutlineRadius();
      const radius = baseCheckpointRadius();
      const arrowLength = baseArrowLength();
      const arrowHeadLength = baseArrowHeadLength();
      const connectingLineWidth = baseConnectingLineWidth();
      const wpLength = baseWpLength();
      const [selectedId, selectedIndex] = this.selectedIndex ?? [];
      const [hoveredId, hoveredIndex] = this.hoveredIndex ?? [];

      const groups = Object.entries(this.groups);

      for (let g = 0; g < groups.length; g++) {
        const [id, group] = groups[g];
        if (group.trackMode) {
          // Draw connecting polyline.
          const mp0 = this.getCanvasPosition(group.points[0].mapPosition);
          this.mapCanvasCtx.beginPath();
          this.mapCanvasCtx.moveTo(mp0.x, mp0.y);
          for (let i = 1; i < group.points.length; i++) {
            const mp = this.getCanvasPosition(group.points[i].mapPosition);
            this.mapCanvasCtx.lineTo(mp.x, mp.y);
          }
          this.mapCanvasCtx.strokeStyle = group.lineColor;
          this.mapCanvasCtx.lineWidth = connectingLineWidth;
          this.mapCanvasCtx.stroke();
        }

        const showWpWidth = this.showWpWidth || group.forceShowGate;
        for (let i = 0; i < group.points.length; i++) {
          const wp = group.points[i];
          const mp = this.getCanvasPosition(wp.mapPosition);
          const selectedColor = showWpWidth ? wp.color.gateSelected : wp.color.selected;
          const pointColor = showWpWidth ? wp.color.gate : wp.color.point;
          const hoverColor = showWpWidth ? wp.color.gateHover : wp.color.hover;
          const color =
            id === selectedId && i === selectedIndex && group.selectable
              ? selectedColor
              : id === hoveredId && i === hoveredIndex && group.hoverable
                ? hoverColor
                : pointColor;
          if (group.trackMode && id === selectedId && i === selectedIndex) {
            this.mapCanvasCtx.globalAlpha = 0.6;
          }
          this.drawPoint(
            wp,
            mp,
            color,
            wp.color.outline,
            wp.color.arrowColor,
            lineWidth,
            radius,
            arrowHeadLength,
            wpLength,
            arrowLength,
            group.trackMode,
            showWpWidth,
          );
          this.mapCanvasCtx.globalAlpha = 1;
        }

        for (let i = 0; i < group.points.length; i++) {
          const wp = group.points[i];
          if (wp.label) {
            const mp = this.getCanvasPosition(wp.mapPosition);
            this.drawLabel(mp, lineWidth, radius, wp.label, wp.color.label, wp.color.labelOutline);
          }
        }

        if (group.draggable && this.selectedIndex !== undefined && this.selectedPoint) {
          const wp = this.selectedPoint;
          const mp = this.getCanvasPosition(this.selectedPoint!.mapPosition);
          this.drawPoint(
            wp,
            mp,
            wp.color.selected,
            wp.color.outline,
            wp.color.arrowColor,
            lineWidth,
            radius,
            arrowHeadLength,
            wpLength,
            arrowLength,
            group.trackMode,
            showWpWidth,
          );
          if (wp.label) {
            this.drawLabel(mp, lineWidth, radius, wp.label, wp.color.label, wp.color.labelOutline);
          }
        }
      }
    }
  };

  private drawPoint(
    wp: Pick<PointBase, 'yaw' | 'scaleY'>,
    mp: Vector2,
    pointColor: string,
    pointOutlineColor: string,
    arrowColor: string,
    lineWidth: number,
    radius: number,
    arrowHeadLength: number,
    wpLength: number,
    arrowLength: number,
    trackMode: boolean,
    showWpWidth: boolean,
  ) {
    if (trackMode) {
      if (showWpWidth) {
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
        this.mapCanvasCtx!.strokeStyle = pointColor;
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
        this.mapCanvasCtx!.fillStyle = arrowColor;
        this.mapCanvasCtx!.fill();
      }
    }

    if (!trackMode || !showWpWidth) {
      this.mapCanvasCtx!.beginPath();
      this.mapCanvasCtx!.arc(mp.x, mp.y, radius, 0, 2 * Math.PI);
      this.mapCanvasCtx!.fillStyle = pointColor;
      this.mapCanvasCtx!.fill();
      this.mapCanvasCtx!.strokeStyle = pointOutlineColor;
      this.mapCanvasCtx!.lineWidth = lineWidth;
      this.mapCanvasCtx!.stroke();
    }
  }

  private drawLabel(
    mp: Vector2,
    lineWidth: number,
    radius: number,
    label: string,
    labelColor: string,
    labelOutlineColor: string,
  ) {
    this.mapCanvasCtx!.font = `${Math.max(14, radius * 1.5)}px sans-serif`;
    this.mapCanvasCtx!.textAlign = 'center';
    this.mapCanvasCtx!.textBaseline = 'bottom';
    this.mapCanvasCtx!.strokeStyle = labelOutlineColor;
    this.mapCanvasCtx!.fillStyle = labelColor;
    this.mapCanvasCtx!.lineWidth = lineWidth * 2;
    this.mapCanvasCtx!.strokeText(label, mp.x, mp.y - radius - 4);
    this.mapCanvasCtx!.fillText(label, mp.x, mp.y - radius - 4);
  }

  zoomFit() {
    if (this.hasTrack && this.hasOneTrackOnly && this.groups) {
      const track = Object.values(this.groups).find((g) => g.trackMode);
      if (track) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        track.points.forEach((point) => {
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
          this.currentScale = Math.min(MAX_SCALE, currentScaleY);
          this.offsetY = -minY * this.currentScale + FIT_PADDING;
          const midpointX = (minX + maxX) / 2;
          this.offsetX = -midpointX * this.currentScale + this.mapCanvas.width / 2;
        }
        this.updateRecenterBtn(true);
        return;
      }
    }

    const currentScaleX = this.mapCanvas.width / MAP_SIZE;
    const currentScaleY = this.mapCanvas.height / MAP_SIZE;
    this.currentScale = Math.max(MIN_SCALE, Math.min(currentScaleX, currentScaleY));
    const midpointY = MAP_SIZE / 2;
    this.offsetY = -midpointY * this.currentScale + this.mapCanvas.height / 2;
    const midpointX = MAP_SIZE / 2;
    this.offsetX = -midpointX * this.currentScale + this.mapCanvas.width / 2;

    this.updateRecenterBtn(true);
  }

  private updateRecenterBtn(centered: boolean) {
    if (centered) {
      this.recenterButton.classList.add('btn--hide');
    } else {
      this.recenterButton.classList.remove('btn--hide');
    }
  }

  private updateHovered(id: string | undefined, index: number | undefined) {
    if (id !== undefined && index !== undefined) {
      this.hoveredIndex = [id, index];
    } else {
      this.hoveredIndex = undefined;
    }
    if (this.hoveredIndex?.[0] !== id && this.hoveredIndex?.[1] !== index) {
      const event = new CustomEvent('mt-map:point-hover', {
        bubbles: false,
        detail: { id, index } as { id: string; index: number },
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

    if (this.isPointDragging && this.selectedIndex !== undefined && this.selectedPoint) {
      this.selectedPoint.mapPosition.x = (scaled(currentX) - this.offsetX) / this.currentScale;
      this.selectedPoint.mapPosition.y = (scaled(currentY) - this.offsetY) / this.currentScale;

      const event = new CustomEvent('mt-map:point-move', {
        bubbles: false,
        detail: {
          id: this.selectedIndex[0],
          index: this.selectedIndex[1],
          position: unTransformPoint(this.selectedPoint.mapPosition),
        },
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

    if (this.groups) {
      const hoverX = scaled(currentX);
      const hoverY = scaled(currentY);
      const selectRadius = baseSelectRadius();
      const [selectedId, selectedIndex] = this.selectedIndex ?? [];

      let hoveredId: string | undefined;
      let hoveredIndex: number | undefined;
      let closest = Infinity;

      const groups = Object.entries(this.groups);

      for (let g = 0; g < groups.length; g++) {
        const [id, group] = groups[g];
        if (!group.hoverable) {
          continue;
        }

        for (let i = 0; i < group.points.length; i++) {
          const mp = this.getCanvasPosition(
            selectedId === id && selectedIndex === i ? this.selectedPoint!.mapPosition : group.points[i].mapPosition,
          );
          const dist = squaredHypot(hoverX - mp.x, hoverY - mp.y);

          if (dist <= selectRadius && dist <= closest) {
            hoveredId = id;
            hoveredIndex = i;
            closest = dist;
          }
        }
      }

      this.updateHovered(hoveredId, hoveredIndex);
      if (hoveredIndex !== undefined && hoveredId !== undefined) {
        if (this.groups[hoveredId].draggable && hoveredId === selectedId && hoveredIndex === selectedIndex) {
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
    if (
      !this.groups ||
      this.hoveredIndex === undefined ||
      (this.selectedIndex?.[0] === this.hoveredIndex[0] && this.selectedIndex[1] === this.hoveredIndex[1])
    ) {
      return;
    }

    if (!this.groups[this.hoveredIndex[0]].selectable) {
      return;
    }

    this.mapCanvas.style.cursor = 'pointer';

    this.selectedIndex = this.hoveredIndex;
    this.selectedPoint = copyPointSelected(this.groups[this.selectedIndex[0]].points[this.selectedIndex[1]]);

    const event = new CustomEvent('mt-map:point-click', {
      bubbles: false,
      detail: { id: this.selectedIndex[0], index: this.selectedIndex[1] },
    }) satisfies MotorTownMapEvent['mt-map:point-click'];
    this.dispatchEvent(event);
  };

  private mouseDownEvent = (e: MouseEvent | TouchEvent) => {
    this.isDragging = true;

    const rect = this.mapCanvas.getBoundingClientRect();
    const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches[0].clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as TouchEvent).touches[0].clientY;

    if (this.groups && this.selectedIndex && this.groups[this.selectedIndex[0]].draggable && this.selectedPoint) {
      const currentX = scaled(clientX - rect.left);
      const currentY = scaled(clientY - rect.top);
      const selectRadius = baseSelectRadius();

      const mp = this.getCanvasPosition(this.selectedPoint.mapPosition);
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
    sheet.insertRule(':host { position: relative; display: flex; }');
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

  attributeChangedCallback(
    name: (typeof MotorTownMap)['observedAttributes'][number],
    oldValue: string | null,
    newValue: string | null,
  ) {
    if (name === 'map' && newValue !== oldValue) {
      this.mapImage = new Image();
      this.mapLoaded = false;
      this.mapImage.onload = () => {
        this.mapLoaded = true;
      };
      this.mapImage.src = newValue ?? '';
    } else if (name === 'road' && newValue !== oldValue) {
      this.roadImage = new Image();
      this.roadLoaded = false;
      this.roadImage.onload = () => {
        this.roadLoaded = true;
      };
      this.roadImage.src = newValue ?? '';
    }
  }
}

customElements.define('mt-map', MotorTownMap);
