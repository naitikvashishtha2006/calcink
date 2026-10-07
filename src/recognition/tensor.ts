import type {
  RecognitionInput,
} from "./preprocess";

export type StrokeTensor = {
  data: Float32Array;
  shape: [number, number];
};

export function strokesToTensor(
  input: RecognitionInput
): StrokeTensor {
  const values: number[] = [];

  for (
    const stroke of input.strokes
  ) {
    for (
      const point of stroke.points
    ) {
      const normalizedX =
        input.width === 0
          ? 0
          : point.x / input.width;

      const normalizedY =
        input.height === 0
          ? 0
          : point.y / input.height;

      values.push(
        normalizedX,
        normalizedY
      );
    }
  }

  return {
    data: new Float32Array(
      values
    ),

    shape: [
      values.length / 2,
      2,
    ],
  };
}