// components/map.ts
function scaled(x) {
  return x * window.devicePixelRatio;
}
var MotorTownMap = class extends HTMLElement {
  points = void 0;
  currentScale = 1;
  offsetX = 0;
  offsetY = 0;
  isDragging = false;
  lastX = 0;
  lastY = 0;
  mapCanvas = document.createElement("canvas");
  mapCanvasCtx = this.mapCanvas.getContext("2d");
  mapImage = new Image();
  mapLoaded = false;
  constructor() {
    super();
  }
  getMarkerScale() {
    const markerScale = scaled(10 / this.currentScale);
    return markerScale;
  }
  baseCheckpointRadius = () => scaled(0.5);
  baseArrowLength = () => scaled(2);
  baseArrowHeadLength = () => scaled(1);
  baseConnectingLineWidth = () => scaled(0.2);
  baseArrowLineWidth = () => scaled(0.2);
  baseLabelFontSize = () => scaled(0.6);
  selectRadius = () => this.baseCheckpointRadius() + scaled(0.5);
  selectedIndex = void 0;
  hoveredIndex = void 0;
  getSelectRadius() {
    const selectRadius = (this.baseCheckpointRadius() + scaled(0.5)) * this.getMarkerScale();
    return selectRadius;
  }
  setPoint(points) {
    this.points = points.map((point) => ({
      ...point,
      mapPosition: this.transformPoint(point.position)
    }));
  }
  transformPoint(point) {
    const x = point.x, y = point.y;
    const maxSize = Math.max(this.mapCanvas.width, this.mapCanvas.height);
    const xp = (x + 128e4) / 22e5 * maxSize;
    const yp = (y + 32e4) / 22e5 * maxSize;
    return { x: xp, y: yp };
  }
  drawMap() {
    if (!this.mapCanvasCtx) {
      console.error("mapCanvas not found");
      return;
    }
    this.mapCanvasCtx.reset();
    this.mapCanvasCtx.fillStyle = " #375d87";
    this.mapCanvasCtx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    this.mapCanvasCtx.save();
    this.mapCanvasCtx.translate(this.offsetX, this.offsetY);
    this.mapCanvasCtx.scale(this.currentScale, this.currentScale);
    let mapWidth = this.mapCanvas.width;
    let mapHeight = this.mapCanvas.height;
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
      const lineWidth = scaled(0.1 * markerScale);
      const radius = this.baseCheckpointRadius() * markerScale;
      for (let i = 0; i < this.points.length; i++) {
        const wp = this.points[i];
        const mp = wp.mapPosition;
        this.mapCanvasCtx.beginPath();
        this.mapCanvasCtx.arc(mp.x, mp.y, radius, 0, 2 * Math.PI);
        this.mapCanvasCtx.fillStyle = i === this.selectedIndex ? "#002cdf" : "#dfb300";
        this.mapCanvasCtx.fill();
        this.mapCanvasCtx.strokeStyle = "black";
        this.mapCanvasCtx.lineWidth = lineWidth;
        this.mapCanvasCtx.stroke();
      }
    }
    this.mapCanvasCtx.restore();
  }
  zoomFit() {
    if (!this.mapCanvasCtx) {
      console.error("mapCanvas not found");
      return;
    }
    this.currentScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateRecenterBtn(true);
    this.drawMap();
  }
  updateRecenterBtn(centered) {
    console.log(centered);
  }
  updateHovered(index) {
    this.hoveredIndex = index;
    this.drawMap();
  }
  wheelEvent = (e) => {
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
  mouseMoveEvent = (e) => {
    e.preventDefault();
    const rect = this.mapCanvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches[0].clientX;
    const clientY = e.clientY ?? e.touches[0].clientY;
    if (this.isDragging) {
      this.mapCanvas.style.cursor = "grabbing";
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
      let hoveredIndex;
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
      if (hoveredIndex !== void 0) {
        this.mapCanvas.style.cursor = "pointer";
      } else {
        this.mapCanvas.style.cursor = "grab";
      }
    }
  };
  clickEvent = () => {
    if (this.isDragging) return;
    if (!this.hoveredIndex) return;
    this.mapCanvas.style.cursor = "pointer";
    this.selectedIndex = this.hoveredIndex;
    this.drawMap();
  };
  mouseDownEvent = (e) => {
    this.isDragging = true;
    const rect = this.mapCanvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches[0].clientX;
    const clientY = e.clientY ?? e.touches[0].clientY;
    this.lastX = clientX - rect.left;
    this.lastY = clientY - rect.top;
  };
  mouseUpEvent = () => {
    this.isDragging = false;
  };
  resizeEvent = () => {
    const canvasBound = this.mapCanvas.getBoundingClientRect();
    this.mapCanvas.width = scaled(canvasBound.width);
    this.mapCanvas.height = scaled(canvasBound.height);
    if (this.points) {
      this.setPoint(this.points);
    }
    this.updateRecenterBtn(false);
    this.drawMap();
  };
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    const canvasBound = this.mapCanvas.getBoundingClientRect();
    this.mapCanvas.width = scaled(canvasBound.width);
    this.mapCanvas.height = scaled(canvasBound.height);
    this.mapImage.onload = () => {
      this.mapLoaded = true;
      this.currentScale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.drawMap();
    };
    this.mapImage.src = "map.png";
    this.mapCanvas.addEventListener("wheel", this.wheelEvent, {
      passive: false
    });
    this.mapCanvas.addEventListener("mousemove", this.mouseMoveEvent, {
      passive: false
    });
    this.mapCanvas.addEventListener("touchmove", this.mouseMoveEvent, {
      passive: false
    });
    this.mapCanvas.addEventListener("click", this.clickEvent, {
      passive: true
    });
    this.mapCanvas.addEventListener("mousedown", this.mouseDownEvent, {
      passive: true
    });
    this.mapCanvas.addEventListener("touchstart", this.mouseDownEvent, {
      passive: true
    });
    this.mapCanvas.addEventListener("mouseup", this.mouseUpEvent, {
      passive: true
    });
    this.mapCanvas.addEventListener("mouseleave", this.mouseUpEvent, {
      passive: true
    });
    this.mapCanvas.addEventListener("touchend", this.mouseUpEvent, {
      passive: true
    });
    window.addEventListener("resize", this.resizeEvent, {
      passive: true
    });
    shadow.appendChild(this.mapCanvas);
  }
  disconnectedCallback() {
    this.mapCanvas.removeEventListener("wheel", this.wheelEvent);
    this.mapCanvas.removeEventListener("mousemove", this.mouseMoveEvent);
    this.mapCanvas.removeEventListener("touchmove", this.mouseMoveEvent);
    this.mapCanvas.removeEventListener("click", this.clickEvent);
    this.mapCanvas.removeEventListener("mousedown", this.mouseDownEvent);
    this.mapCanvas.removeEventListener("touchstart", this.mouseDownEvent);
    this.mapCanvas.removeEventListener("mouseup", this.mouseUpEvent);
    this.mapCanvas.removeEventListener("mouseleave", this.mouseUpEvent);
    this.mapCanvas.removeEventListener("touchend", this.mouseUpEvent);
    window.removeEventListener("resize", this.resizeEvent);
  }
};
customElements.define("mt-map", MotorTownMap);
export {
  MotorTownMap
};
