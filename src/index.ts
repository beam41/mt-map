import outData from '../out_ev_charger.json';
import { mapCanvas } from './element.generated';
import type { MotorTownMap } from '../dist/map';

const mapCanvasElement = mapCanvas as MotorTownMap;

mapCanvasElement.setPoints(
  outData.map((data) => ({
    position: data,
  })),
);
