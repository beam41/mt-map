export function isMobileAndTablet() {
  /* eslint-disable */
  let check = false;
  (function (a) {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
        a,
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(
        a.substr(0, 4),
      )
    )
      check = true;
  })(navigator.userAgent || navigator.vendor || (window as any).opera);
  return check;
  /* eslint-enable */
}

import centerSvg from './center.svg';

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

  private getMarkerScale() {
    const markerScale = this.scaled(10 / this.currentScale);
    return markerScale;
  }

  private baseCheckpointRadius = () => this.scaled(0.5);
  private baseArrowLength = () => this.scaled(2);
  private baseArrowHeadLength = () => this.scaled(1);
  private baseConnectingLineWidth = () => this.scaled(0.2);
  private baseArrowLineWidth = () => this.scaled(0.2);
  private baseLabelFontSize = () => this.scaled(0.6);
  private selectRadius = () => this.baseCheckpointRadius() + this.scaled(0.5);

  private selectedIndex: number | undefined = undefined;
  private hoveredIndex: number | undefined = undefined;

  private getSelectRadius() {
    const selectRadius = (this.baseCheckpointRadius() + this.scaled(0.5)) * this.getMarkerScale();
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

  drawMap() {
    if (!this.mapCanvasCtx) {
      console.error('mapCanvas not found');
      return;
    }
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
      const lineWidth = this.scaled(0.1 * markerScale);
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

    this.mapCanvasCtx.restore();
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
      const currentScaleX = (this.mapCanvas.width - this.scaled(FIT_PADDING * 2)) / deltaX;
      const currentScaleY = (this.mapCanvas.height - this.scaled(FIT_PADDING * 2)) / deltaY;
      if (currentScaleX < currentScaleY) {
        this.currentScale = Math.min(40, currentScaleX);
        this.offsetX = -minX * this.currentScale + this.scaled(FIT_PADDING);
        const midpointY = (minY + maxY) / 2;
        this.offsetY = -midpointY * this.currentScale + this.mapCanvas.height / 2;
      } else {
        this.currentScale = Math.min(40, currentScaleY);
        this.offsetY = -minY * this.currentScale + this.scaled(FIT_PADDING);
        const midpointX = (minX + maxX) / 2;
        this.offsetX = -midpointX * this.currentScale + this.mapCanvas.width / 2;
      }
    } else {
      this.currentScale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
    }

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
    if (this.hoveredIndex !== index) {
      this.hoveredIndex = index;
      const event = new CustomEvent('mt-map:point-hover' as MotorTownMapEventKey, {
        bubbles: false,
        detail: { index: index },
      }) satisfies MotorTownMapEvent['mt-map:point-hover'];

      // Dispatch the event.
      this.dispatchEvent(event);
      this.drawMap();
    }
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
      this.offsetX += this.scaled(dx);
      this.offsetY += this.scaled(dy);
      this.updateRecenterBtn(false);
      this.drawMap();
      return;
    }

    if (this.points) {
      const hoverX = (this.scaled(clientX) - this.scaled(rect.left) - this.offsetX) / this.currentScale;
      const hoverY = (this.scaled(clientY) - this.scaled(rect.top) - this.offsetY) / this.currentScale;
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
    this.mapCanvas.width = this.scaled(canvasBound.width);
    this.mapCanvas.height = this.scaled(canvasBound.height);
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
    this.isMobileAndTablet = isMobileAndTablet();
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
    this.mapCanvas.width = this.scaled(canvasBound.width);
    this.mapCanvas.height = this.scaled(canvasBound.height);
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

  attributeChangedCallback(name: (typeof MotorTownMap.observedAttributes)[number], _: string, newValue: string) {
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
      case 'point-hover-color': {
        const v = newValue.trim();
        this.pointHoverColor = v;
        this.drawMap();
        break;
      }
    }
  }
}

customElements.define('mt-map', MotorTownMap);
