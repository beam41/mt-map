import outData from '../extract/out.json';
import { mapCanvas } from './element.generated';
import type { MotorTownMap } from '../dist/map';

const mapCanvasElement = mapCanvas as MotorTownMap;

mapCanvasElement.setPoint(
  outData.map((data) => ({
    position: data.relativeLocation,
  })),
);

mapCanvasElement.addEventListener<'mt-map:point-click'>('mt-map:point-click', (ev) => {
  console.log(ev.detail.index);
});
