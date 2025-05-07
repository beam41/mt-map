import type { Vector2 } from '../map';

export function rotatePoints(point1: Vector2, point2: Vector2, yaw: number) {
  const centerX =(point1.x + point2.x) / 2;
  const centerY = (point1.y + point2.y) / 2;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  const translatedPoint1X = point1.x -centerX;
  const translatedPoint1Y = point1.y - centerY;
  const rotatedPoint1 = {
    x: cosYaw * translatedPoint1X + -sinYaw * translatedPoint1Y + centerX,
    y: sinYaw * translatedPoint1X + cosYaw * translatedPoint1Y + centerY,
  };

  const translatedPoint2X = point2.x - centerX;
  const translatedPoint2Y =  point2.y - centerY;
  const rotatedPoint2 = {
    x: cosYaw * translatedPoint2X + -sinYaw * translatedPoint2Y + centerX,
    y: sinYaw * translatedPoint2X + cosYaw * translatedPoint2Y + centerY,
  };

  return [rotatedPoint1, rotatedPoint2];
}
