export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Vector2 = {
  x: number;
  y: number;
};

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type DeliveryPoints = {
  type: string;
  name: string;
  relativeLocation: Vector3;
  guid: string;
  guidShort: string;
  productionConfigs: ProductionConfig[];
  demandConfigs: DemandConfig[];
  mapLocation: Vector2;
};

export type ProductionConfig = {
  inputCargos: ProductionCargo[];
  outputCargos: ProductionCargo[];
  productionTimeSeconds: number;
  productionSpeedMultiplier: number;
  localFoodSupply: number;
};

export type ProductionCargo = {
  cargoType: string | null;
  cargoKey: string | null;
  value: number;
  maxStorage: number;
};

export interface DemandConfig {
  cargoType: string | null;
  cargoKey: string | null;
  maxStorage: number;
  paymentMultiplier: number;
}
