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
export type ColorLine = {
    line?: string;
};
export type GroupColor = Color & ColorLine;
export type PointBase = {
    position: Vector2;
    yaw?: number;
    scaleY?: number;
    mapPosition: Vector2;
    color?: Color;
    label?: string;
};
export type PointsGroupTrackMode = {
    trackMode: true;
    forceShowGate?: boolean;
} | {
    trackMode?: false;
};
export type PointsGroupBase<T> = {
    points: T[];
    color?: GroupColor;
    draggable?: boolean;
    hidden?: boolean;
    hoverable?: boolean;
    selectable?: boolean;
} & PointsGroupTrackMode;
export type PointLocal = PointBase & {
    color: Required<Color>;
};
export type PointsLocalGroup = Required<Omit<PointsGroupBase<PointLocal>, 'color' | 'hidden'> & {
    lineColor?: string;
} & Pick<Required<PointsGroupTrackMode> & {
    forceShowGate: boolean;
}, 'trackMode' | 'forceShowGate'>>;
export type PointsLocalGroups = Record<string, PointsLocalGroup>;
export type Point = Omit<PointBase, 'mapPosition'>;
export type PointsGroup = PointsGroupBase<Point>;
export type PointsGroups = Record<string, PointsGroup>;
export type Vector2 = {
    x: number;
    y: number;
};
export type MotorTownMapEvent = {
    'mt-map:point-click': CustomEvent<{
        id: string;
        index: number;
    }>;
    'mt-map:point-hover': CustomEvent<{
        id: undefined;
        index: undefined;
    } | {
        id: string;
        index: number;
    }>;
    'mt-map:point-move': CustomEvent<{
        id: string;
        index: number;
        position: Vector2;
    }>;
};
type MotorTownMapEventKey = keyof MotorTownMapEvent;
export interface MotorTownMap {
    addEventListener<K extends MotorTownMapEventKey>(event: K, listener: (this: MotorTownMap, ev: MotorTownMapEvent[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends MotorTownMapEventKey>(event: K, listener: (this: MotorTownMap, ev: MotorTownMapEvent[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
export declare class MotorTownMap extends HTMLElement {
    static readonly observedAttributes: readonly ["map", "road"];
    private groups;
    private hasTrack;
    private hasOneTrackOnly;
    private showWpWidth;
    private currentScale;
    private offsetX;
    private offsetY;
    private isDragging;
    private isPointDragging;
    private lastX;
    private lastY;
    private mapCanvas;
    private mapCanvasCtx;
    private mapImage;
    private mapLoaded;
    private roadImage;
    private roadLoaded;
    private recenterButton;
    private showWpWidthButton;
    private zoomInButton;
    private zoomOutButton;
    constructor();
    private selectedPoint;
    private selectedIndex;
    private hoveredIndex;
    setPoints(groups: PointsGroups, reset?: boolean): void;
    setSelectedIndex(id: string | undefined, index: number | undefined): void;
    setSelectedPointYaw(yaw: number): void;
    setSelectedPointScaleY(scaleY: number): void;
    setSelectedPointPosition(pos: Vector2): void;
    private getCanvasPosition;
    private prevMapLoaded;
    private prevRoadLoaded;
    private prevOffsetX;
    private prevOffsetY;
    private prevCurrentScale;
    private prevMapCanvasWidth;
    private prevMapCanvasHeight;
    private prevGroups;
    private prevSelectedIndex;
    private prevHoveredIndex;
    private prevShowWpWidth;
    private prevSelectedPointScaleY;
    private prevSelectedPointYaw;
    private prevSelectedPointPositionX;
    private prevSelectedPointPositionY;
    private stateChange;
    private animationRequestId;
    private drawMap;
    private drawPoint;
    private drawLabel;
    zoomFit(): void;
    private updateRecenterBtn;
    private updateHovered;
    private wheelEvent;
    private doZoom;
    private zoomInClick;
    private zoomOutClick;
    private mouseMoveEvent;
    private clickEvent;
    private mouseDownEvent;
    private mouseUpEvent;
    private resizeEvent;
    private recenterClick;
    private showWpWidthClick;
    private resizeObserver;
    protected connectedCallback(): void;
    protected disconnectedCallback(): void;
    attributeChangedCallback(name: (typeof MotorTownMap)['observedAttributes'][number], oldValue: string | null, newValue: string | null): void;
}
export {};
