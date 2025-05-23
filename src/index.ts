import outEv from '../out_ev_charger.json';
import outBus from '../out_bus_stop.json';
import outDeliveryPoint from '../out_delivery_point.json';
import { mapCanvas } from './element.generated';
import type { MotorTownMap } from '../dist/map';

const mapCanvasElement = mapCanvas as MotorTownMap;

mapCanvasElement.setPoints({
  ev: {
    points: outEv.map((data) => ({
      position: data,
    })),
    color: { point: '#FDD835', hover: '#FFF59D', selected: '#F57F17' },
  },
  bus: {
    points: outBus.map((data) => ({
      position: data.relativeLocation,
    })),
    color: { point: '#7CB342', hover: '#C5E1A5', selected: '#33691E' },
  },
  deliveryPoint: {
    points: outDeliveryPoint.map((data) => ({
      position: data.relativeLocation,
    })),
    color: { point: '#E53935', hover: '#EF9A9A', selected: '#B71C1C' },
  },
});
