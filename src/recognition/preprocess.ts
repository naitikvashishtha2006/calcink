import type { Point, Stroke } from "../types/stroke";

export type NormalizedStroke = {
  points: Point[];
  width: number;
};

export type RecognitionInput = {
  strokes: NormalizedStroke[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export function preprocessStrokes(
  strokes: Stroke[]
): RecognitionInput | null {
  if (strokes.length === 0) {
    return null;
  }

  const allPoints: Point[] = [];

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      allPoints.push(point);
    }
  }

  if (allPoints.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of allPoints) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);

    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  const normalizedStrokes: NormalizedStroke[] =
    strokes.map((stroke) => ({
      width: stroke.width,

      points: stroke.points.map(
        (point) => ({
          x: point.x - minX,
          y: point.y - minY,
        })
      ),
    }));

  return {
    strokes: normalizedStrokes,

    minX,
    minY,
    maxX,
    maxY,

    width,
    height,
  };
}