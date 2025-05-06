import type { Vector2 } from '../map';

export function rotatePoints(point1: Vector2, point2: Vector2, yaw: number) {
  const center = [(point1.x + point2.x) / 2, (point1.y + point2.y) / 2];

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  const rotationMatrix = [
    [cosYaw, -sinYaw],
    [sinYaw, cosYaw],
  ];

  const translatedPoint1 = [point1.x - center[0], point1.y - center[1]];
  const rotatedTranslatedPoint1 = [
    rotationMatrix[0][0] * translatedPoint1[0] + rotationMatrix[0][1] * translatedPoint1[1],
    rotationMatrix[1][0] * translatedPoint1[0] + rotationMatrix[1][1] * translatedPoint1[1],
  ];
  const rotatedPoint1 = {
    x: rotatedTranslatedPoint1[0] + center[0],
    y: rotatedTranslatedPoint1[1] + center[1],
  };

  const translatedPoint2 = [point2.x - center[0], point2.y - center[1]];
  const rotatedTranslatedPoint2 = [
    rotationMatrix[0][0] * translatedPoint2[0] + rotationMatrix[0][1] * translatedPoint2[1],
    rotationMatrix[1][0] * translatedPoint2[0] + rotationMatrix[1][1] * translatedPoint2[1],
  ];
  const rotatedPoint2 = {
    x: rotatedTranslatedPoint2[0] + center[0],
    y: rotatedTranslatedPoint2[1] + center[1],
  };

  return [rotatedPoint1, rotatedPoint2];
}
