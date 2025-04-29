import centerSvg from './center.svg';

function scaled(x: number) {
  return x * window.devicePixelRatio;
}

export type Points = {
  position: Vector2;
  rotation?: Quaternion;
};

export type PointsLocal = {
  position: Vector2;
  rotation?: Quaternion;
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
};

type MotorTownMapEventKey = keyof MotorTownMapEvent;

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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MotorTownMap extends HTMLElement {
  static observedAttributes = ['track-mode', 'point-color', 'point-selected-color'];

  private trackMode = false;
  private pointColor = '#dfb300';
  private pointSelectedColor = '#002cdf';

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

  private getMarkerScale() {
    const markerScale = scaled(10 / this.currentScale);
    return markerScale;
  }

  private baseCheckpointRadius = () => scaled(0.5);
  private baseArrowLength = () => scaled(2);
  private baseArrowHeadLength = () => scaled(1);
  private baseConnectingLineWidth = () => scaled(0.2);
  private baseArrowLineWidth = () => scaled(0.2);
  private baseLabelFontSize = () => scaled(0.6);
  private selectRadius = () => this.baseCheckpointRadius() + scaled(0.5);

  private selectedIndex: number | undefined = undefined;
  private hoveredIndex: number | undefined = undefined;

  private getSelectRadius() {
    const selectRadius = (this.baseCheckpointRadius() + scaled(0.5)) * this.getMarkerScale();
    return selectRadius;
  }

  setPoint(points: Points[]) {
    this.points = points.map((point) => ({
      ...point,
      mapPosition: this.transformPoint(point.position),
    }));
  }

  private transformPoint(point: Vector2) {
    const x = point.x,
      y = point.y;
    const maxSize = Math.max(this.mapCanvas.width, this.mapCanvas.height);
    const xp = ((x + 1280000) / 2200000) * maxSize;
    const yp = ((y + 320000) / 2200000) * maxSize;
    return { x: xp, y: yp };
  }

  private drawMap() {
    if (!this.mapCanvasCtx) {
      console.error('mapCanvas not found');
      return;
    }
    this.mapCanvasCtx.reset();
    this.mapCanvasCtx.fillStyle = ' #375d87';
    this.mapCanvasCtx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);

    this.mapCanvasCtx.save();
    this.mapCanvasCtx.translate(this.offsetX, this.offsetY);
    this.mapCanvasCtx.scale(this.currentScale, this.currentScale);

    let mapWidth = this.mapCanvas.width;
    let mapHeight = this.mapCanvas.height;
    // Draw the map image.
    if (this.mapImage && this.mapLoaded) {
      if (mapWidth > mapHeight) {
        mapHeight = mapWidth * (this.mapImage.height / this.mapImage.width);
      } else {
        mapWidth = mapHeight * (this.mapImage.width / this.mapImage.height);
      }
      this.mapCanvasCtx.imageSmoothingEnabled = false;
      this.mapCanvasCtx.drawImage(this.mapImage, 0, 0, mapWidth, mapHeight);
    } else if (mapWidth > mapHeight) {
      mapHeight = mapWidth;
    } else {
      mapWidth = mapHeight;
    }

    if (this.points) {
      const markerScale = this.getMarkerScale();
      // Draw each waypoint with its arrow and label.
      const lineWidth = scaled(0.1 * markerScale);
      const radius = this.baseCheckpointRadius() * markerScale;
      const arrowLength = this.baseArrowLength();
      const arrowHeadLength = this.baseArrowHeadLength();
      const arrowLineLength = this.baseArrowLineWidth();
      const connectingLineWidth = this.baseConnectingLineWidth();

      if (this.trackMode) {
        // Draw connecting polyline.
        this.mapCanvasCtx.beginPath();
        this.mapCanvasCtx.moveTo(this.points[0].mapPosition.x, this.points[0].mapPosition.y);
        for (let i = 1; i < this.points.length; i++) {
          const pt = this.points[i];
          this.mapCanvasCtx.lineTo(pt.mapPosition.x, pt.mapPosition.y);
        }
        this.mapCanvasCtx.strokeStyle = 'white';
        this.mapCanvasCtx.lineWidth = connectingLineWidth * markerScale;
        this.mapCanvasCtx.stroke();
      }

      for (let i = 0; i < this.points.length; i++) {
        const wp = this.points[i];
        const mp = wp.mapPosition;
        if (this.trackMode) {
          const yaw = 2 * Math.atan2(wp.rotation?.z ?? 0, wp.rotation?.w ?? 0);
          const dx = arrowLength * markerScale * Math.cos(yaw);
          const dy = arrowLength * markerScale * Math.sin(yaw);
          const arrowBodyLength = (arrowLength * Math.sqrt(3)) / 2;
          const dxBody = arrowBodyLength * markerScale * Math.cos(yaw);
          const dyBody = arrowBodyLength * markerScale * Math.sin(yaw);
          this.mapCanvasCtx.beginPath();
          this.mapCanvasCtx.moveTo(mp.x, mp.y);
          this.mapCanvasCtx.lineTo(mp.x + dxBody, mp.y + dyBody);
          this.mapCanvasCtx.strokeStyle = 'red';
          this.mapCanvasCtx.lineWidth = arrowLineLength * markerScale;
          this.mapCanvasCtx.stroke();
          const fromX = mp.x;
          const fromY = mp.y;
          const toX = mp.x + dx;
          const toY = mp.y + dy;
          const angle = Math.atan2(toY - fromY, toX - fromX);
          this.mapCanvasCtx.beginPath();
          this.mapCanvasCtx.moveTo(toX, toY);
          this.mapCanvasCtx.lineTo(
            toX - arrowHeadLength * markerScale * Math.cos(angle - Math.PI / 6),
            toY - arrowHeadLength * markerScale * Math.sin(angle - Math.PI / 6),
          );
          this.mapCanvasCtx.lineTo(
            toX - arrowHeadLength * markerScale * Math.cos(angle + Math.PI / 6),
            toY - arrowHeadLength * markerScale * Math.sin(angle + Math.PI / 6),
          );
          this.mapCanvasCtx.closePath();
          this.mapCanvasCtx.fillStyle = 'red';
          this.mapCanvasCtx.fill();
        }

        this.mapCanvasCtx.beginPath();
        this.mapCanvasCtx.arc(mp.x, mp.y, radius, 0, 2 * Math.PI);
        this.mapCanvasCtx.fillStyle = i === this.selectedIndex ? this.pointSelectedColor : this.pointColor;
        this.mapCanvasCtx.fill();
        this.mapCanvasCtx.strokeStyle = 'black';
        this.mapCanvasCtx.lineWidth = lineWidth;
        this.mapCanvasCtx.stroke();
      }
    }

    this.mapCanvasCtx.restore();
  }

  private zoomFit() {
    if (!this.mapCanvasCtx) {
      console.error('mapCanvas not found');
      return;
    }

    this.currentScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.updateRecenterBtn(true);
    this.drawMap();
  }

  private updateRecenterBtn(centered: boolean) {
    if (centered) {
      this.recenterButton.classList.add('recenterBtn--centered');
    } else {
      this.recenterButton.classList.remove('recenterBtn--centered');
    }
  }

  private updateHovered(index: number | undefined) {
    this.hoveredIndex = index;
    // hoveredInfo.style.display = index === undefined ? 'none' : 'unset';
    // hoveredInfo.innerText = deliveryPoints[index ?? 0].name;
    this.drawMap();
  }

  private wheelEvent = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.mapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = Math.sign(e.deltaY) * -0.1;
    const worldX = (mouseX - this.offsetX) / this.currentScale;
    const worldY = (mouseY - this.offsetY) / this.currentScale;
    let nextCurrentScale = this.currentScale * (1 + zoomFactor);
    nextCurrentScale = Math.max(1, Math.min(50, nextCurrentScale));
    if (nextCurrentScale !== this.currentScale) {
      this.currentScale = nextCurrentScale;
      this.offsetX = mouseX - worldX * this.currentScale;
      this.offsetY = mouseY - worldY * this.currentScale;
      this.updateRecenterBtn(false);
      this.drawMap();
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
      this.offsetX += scaled(dx);
      this.offsetY += scaled(dy);
      this.updateRecenterBtn(false);
      this.drawMap();
    } else if (this.points) {
      const hoverX = (scaled(clientX) - scaled(rect.left) - this.offsetX) / this.currentScale;
      const hoverY = (scaled(clientY) - scaled(rect.top) - this.offsetY) / this.currentScale;
      const selectRadius = this.getSelectRadius();

      let hoveredIndex: number | undefined;
      let closest = Infinity;
      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i].mapPosition;
        const dist = Math.hypot(hoverX - pt.x, hoverY - pt.y);

        if (this.selectedIndex !== i && dist <= selectRadius && dist <= closest) {
          hoveredIndex = i;
          closest = dist;
        }
      }

      this.updateHovered(hoveredIndex);
      if (hoveredIndex !== undefined) {
        this.mapCanvas.style.cursor = 'pointer';
      } else {
        this.mapCanvas.style.cursor = 'grab';
      }
    }
  };

  private clickEvent = () => {
    // Only proceed if not dragging.
    if (this.isDragging) return;
    if (!this.hoveredIndex) return;
    this.mapCanvas.style.cursor = 'pointer';

    this.selectedIndex = this.hoveredIndex;

    const event = new CustomEvent('mt-map:point-click' as MotorTownMapEventKey, {
      bubbles: false,
      detail: { index: this.selectedIndex },
    }) satisfies MotorTownMapEvent['mt-map:point-click'];

    // Dispatch the event.
    this.dispatchEvent(event);

    this.drawMap();
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
    this.mapCanvas.width = scaled(canvasBound.width);
    this.mapCanvas.height = scaled(canvasBound.height);
    if (this.points) {
      this.setPoint(this.points);
    }
    this.updateRecenterBtn(false);
    this.drawMap();
  };

  private recenterClick = () => {
    this.zoomFit();
  };

  protected connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    this.mapImage.onload = () => {
      this.mapLoaded = true;
      this.currentScale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.drawMap();
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
    this.mapCanvas.width = scaled(canvasBound.width);
    this.mapCanvas.height = scaled(canvasBound.height);
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
  }

  attributeChangedCallback(name: 'track-mode' | 'point-color' | 'point-selected-color', _: string, newValue: string) {
    switch (name) {
      case 'track-mode': {
        const v = newValue.trim();
        this.trackMode = v !== '0' && v !== 'false';
        this.drawMap();
        break;
      }
      case 'point-color': {
        const v = newValue.trim();
        this.pointColor = v;
        this.drawMap();
        break;
      }
      case 'point-selected-color': {
        const v = newValue.trim();
        this.pointSelectedColor = v;
        this.drawMap();
        break;
      }
    }
  }
}

customElements.define('mt-map', MotorTownMap);
