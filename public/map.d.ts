export type Points = {
    position: Vector2;
};
export type PointsLocal = {
    position: Vector2;
    mapPosition: Vector2;
};
export type Vector2 = {
    x: number;
    y: number;
};
export declare class MotorTownMap extends HTMLElement {
    private points;
    private currentScale;
    private offsetX;
    private offsetY;
    private isDragging;
    private lastX;
    private lastY;
    private mapCanvas;
    private mapCanvasCtx;
    private mapImage;
    private mapLoaded;
    constructor();
    private getMarkerScale;
    private baseCheckpointRadius;
    private baseArrowLength;
    private baseArrowHeadLength;
    private baseConnectingLineWidth;
    private baseArrowLineWidth;
    private baseLabelFontSize;
    private selectRadius;
    private selectedIndex;
    private hoveredIndex;
    private getSelectRadius;
    setPoint(points: Points[]): void;
    private transformPoint;
    private drawMap;
    private zoomFit;
    private updateRecenterBtn;
    private updateHovered;
    private wheelEvent;
    private mouseMoveEvent;
    private clickEvent;
    private mouseDownEvent;
    private mouseUpEvent;
    private resizeEvent;
    protected connectedCallback(): void;
    disconnectedCallback(): void;
}
