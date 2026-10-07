import {
  InferenceEngine,
  preprocessStrokes,
  isStrokeMeaningful,
  loadVocab,
} from "ink-on/core";

import type {
  Stroke as InkOnStroke,
  Vocab,
} from "ink-on/core";

import type {
  Stroke as CalcInkStroke,
} from "../types/stroke";

const MODEL_BASE = "/models/comer";

let engine: InferenceEngine | null = null;

let vocab: Vocab | null = null;

let initializationPromise: Promise<void> | null = null;


/**
 * Convert CalcInk strokes into the format
 * expected by ink-on.
 */
function convertStrokes(
  strokes: CalcInkStroke[]
): InkOnStroke[] {
  return strokes.map((stroke) => ({
    points: stroke.points,
    lineWidth: stroke.width,
  }));
}


/**
 * Load the handwriting recognition model.
 *
 * The model is loaded only once.
 */
export async function initializeRecognition() {
  // Already initialized
  if (
    engine !== null &&
    vocab !== null
  ) {
    return;
  }

  // Another initialization is already running
  if (
    initializationPromise !== null
  ) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log(
      "Loading handwriting recognition model..."
    );

    // Load vocabulary
    vocab = await loadVocab(
      `${MODEL_BASE}/vocab.json`
    );

    // Create inference engine
    engine = new InferenceEngine({
      encoderUrl:
        `${MODEL_BASE}/encoder_int8.onnx`,

      decoderUrl:
        `${MODEL_BASE}/decoder_int8.onnx`,

      // Keep beam width small for faster inference
      beamWidth: 3,

      executionProvider: "wasm",
    });

    // Initialize ONNX model
    await engine.init();

    console.log(
      "Handwriting recognition model loaded."
    );
  })();

  try {
    await initializationPromise;
  } catch (error) {
    // If initialization fails,
    // allow another attempt later.
    initializationPromise = null;

    engine = null;

    vocab = null;

    throw error;
  }
}


/**
 * Recognize the handwritten strokes.
 */
export async function recognizeStrokes(
  strokes: CalcInkStroke[]
) {
  // Make sure model is loaded
  await initializeRecognition();

  if (
    engine === null ||
    vocab === null
  ) {
    throw new Error(
      "Recognition engine is not initialized."
    );
  }

  // Convert CalcInk strokes
  const inkOnStrokes =
    convertStrokes(strokes);

  // Ignore empty/tiny drawings
  if (
    !isStrokeMeaningful(
      inkOnStrokes
    )
  ) {
    return null;
  }

  // Convert strokes into model input
  const input =
    preprocessStrokes(
      inkOnStrokes
    );

  // Run recognition
  const result =
    await engine.recognize(
      input,
      vocab,
      "number"
    );

  return result;
}


/**
 * Release the model from memory.
 */
export function disposeRecognition() {
  if (engine !== null) {
    engine.dispose();
  }

  engine = null;

  vocab = null;

  initializationPromise = null;
}