import outData from '../out.json';
import { mapCanvas } from './element.generated';
import type { MotorTownMap } from '../dist/map';

const mapCanvasElement = mapCanvas as MotorTownMap;

mapCanvasElement.setPoint(
  outData.map((data) => ({
    position: data.relativeLocation,
  })),
);

mapCanvasElement.addEventListener<'mt-map:point-click'>('mt-map:point-click', (ev) => {
  console.log('mt-map:point-click', ev.detail.index);
});

mapCanvasElement.addEventListener<'mt-map:point-hover'>('mt-map:point-hover', (ev) => {
  console.log('mt-map:point-hover', ev.detail.index);
});
