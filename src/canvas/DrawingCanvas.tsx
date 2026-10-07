import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import type {
  Point,
  Stroke,
} from "../types/stroke";


type DrawingMode =
  | "pen"
  | "stroke-eraser";


type DrawingCanvasProps = {
  onStrokesChange?: (
    strokes: Stroke[]
  ) => void;
};


/*
 * React's pointer event type.
 *
 * Using this type is important because
 * the canvas JSX event handlers expect
 * React.PointerEvent.
 */
type CanvasPointerEvent =
  ReactPointerEvent<HTMLCanvasElement>;


function distance(
  a: Point,
  b: Point
): number {
  const dx =
    a.x - b.x;

  const dy =
    a.y - b.y;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


function distanceToSegment(
  point: Point,
  start: Point,
  end: Point
): number {

  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;


  if (
    dx === 0 &&
    dy === 0
  ) {
    return distance(
      point,
      start
    );
  }


  const t =
    (
      (point.x - start.x) * dx +
      (point.y - start.y) * dy
    ) /
    (dx * dx + dy * dy);


  const clamped =
    Math.max(
      0,
      Math.min(1, t)
    );


  const closest = {
    x:
      start.x +
      clamped * dx,

    y:
      start.y +
      clamped * dy,
  };


  return distance(
    point,
    closest
  );
}


function strokeContainsPoint(
  stroke: Stroke,
  point: Point
): boolean {

  const threshold =
    Math.max(
      18,
      stroke.width * 2.5
    );


  const points =
    stroke.points;


  if (
    points.length === 0
  ) {
    return false;
  }


  if (
    points.length === 1
  ) {

    return (
      distance(
        points[0],
        point
      ) <= threshold
    );

  }


  for (
    let i = 1;
    i < points.length;
    i++
  ) {

    if (
      distanceToSegment(
        point,
        points[i - 1],
        points[i]
      ) <= threshold
    ) {
      return true;
    }

  }


  return false;
}


function createId(): string {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


function DrawingCanvas({
  onStrokesChange,
}: DrawingCanvasProps) {

  /*
   * =====================================
   * CANVAS
   * =====================================
   */

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );


  const contextRef =
    useRef<CanvasRenderingContext2D | null>(
      null
    );


  /*
   * =====================================
   * DRAWING DATA
   *
   * Stored in refs so React does not
   * re-render while the user is drawing.
   * =====================================
   */

  const strokesRef =
    useRef<Stroke[]>([]);


  const currentStrokeRef =
    useRef<Stroke | null>(null);


  const isDrawingRef =
    useRef(false);


  const lastPointRef =
    useRef<Point | null>(null);


  /*
   * Cached canvas position.
   *
   * We don't calculate the DOM rectangle
   * on every pointer movement.
   */

  const canvasRectRef =
    useRef<DOMRect | null>(null);


  /*
   * =====================================
   * SETTINGS
   * =====================================
   */

  const strokeWidthRef =
    useRef(4);


  const modeRef =
    useRef<DrawingMode>("pen");


  /*
   * =====================================
   * UNDO / REDO
   * =====================================
   */

  const undoStackRef =
    useRef<Stroke[][]>([]);


  const redoStackRef =
    useRef<Stroke[][]>([]);


  /*
   * =====================================
   * UI STATE
   * =====================================
   */

  const [mode, setMode] =
    useState<DrawingMode>("pen");


  const [strokeWidth, setStrokeWidth] =
    useState(4);


  const [canUndo, setCanUndo] =
    useState(false);


  const [canRedo, setCanRedo] =
    useState(false);


  /*
   * =====================================
   * REDRAW CANVAS
   *
   * Used only after:
   *
   * - resize
   * - undo
   * - redo
   * - erase
   * - clear
   *
   * NEVER during normal pointer movement.
   * =====================================
   */

  const redrawCanvas =
    useCallback(() => {

      const canvas =
        canvasRef.current;


      const context =
        contextRef.current;


      const rect =
        canvasRectRef.current;


      if (
        !canvas ||
        !context ||
        !rect
      ) {
        return;
      }


      /*
       * Dark notebook background.
       */

      context.fillStyle =
        "#18191b";


      context.fillRect(
        0,
        0,
        rect.width,
        rect.height
      );


      /*
       * White handwriting.
       */

      context.strokeStyle =
        "#ffffff";


      context.fillStyle =
        "#ffffff";


      context.lineCap =
        "round";


      context.lineJoin =
        "round";


      /*
       * Draw existing strokes.
       */

      for (
        const stroke
        of strokesRef.current
      ) {

        const points =
          stroke.points;


        if (
          points.length === 0
        ) {
          continue;
        }


        context.lineWidth =
          stroke.width;


        context.beginPath();


        /*
         * Single point.
         */

        if (
          points.length === 1
        ) {

          context.arc(
            points[0].x,
            points[0].y,
            stroke.width / 2,
            0,
            Math.PI * 2
          );


          context.fill();

          continue;
        }


        /*
         * Multiple points.
         */

        context.moveTo(
          points[0].x,
          points[0].y
        );


        for (
          let i = 1;
          i < points.length;
          i++
        ) {

          context.lineTo(
            points[i].x,
            points[i].y
          );

        }


        context.stroke();

      }

    }, []);


  /*
   * =====================================
   * RESIZE CANVAS
   * =====================================
   */

  const resizeCanvas =
    useCallback(() => {

      const canvas =
        canvasRef.current;


      if (!canvas) {
        return;
      }


      const parent =
        canvas.parentElement;


      if (!parent) {
        return;
      }


      const rect =
        parent.getBoundingClientRect();


      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }


      /*
       * High-DPI / Retina support.
       */

      const dpr =
        Math.min(
          window.devicePixelRatio || 1,
          2
        );


      const width =
        Math.round(
          rect.width * dpr
        );


      const height =
        Math.round(
          rect.height * dpr
        );


      /*
       * Cache rectangle for pointer events.
       */

      canvasRectRef.current =
        rect;


      /*
       * Avoid unnecessary canvas
       * resizing because resizing clears
       * the canvas.
       */

      if (
        canvas.width === width &&
        canvas.height === height
      ) {
        return;
      }


      canvas.width =
        width;


      canvas.height =
        height;


      canvas.style.width =
        `${rect.width}px`;


      canvas.style.height =
        `${rect.height}px`;


      const context =
        canvas.getContext(
          "2d",
          {
            alpha: false,
            desynchronized: true,
          }
        );


      if (!context) {
        return;
      }


      contextRef.current =
        context;


      /*
       * Use CSS pixel coordinates.
       */

      context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );


      context.imageSmoothingEnabled =
        true;


      redrawCanvas();

    }, [redrawCanvas]);


  /*
   * =====================================
   * POINTER → CANVAS POSITION
   * =====================================
   */

  const getPoint =
    useCallback(
      (
        event: CanvasPointerEvent
      ): Point => {

        const rect =
          canvasRectRef.current;


        if (!rect) {

          return {
            x: 0,
            y: 0,
          };

        }


        return {

          x:
            event.clientX -
            rect.left,

          y:
            event.clientY -
            rect.top,

        };

      },
      []
    );


  /*
   * =====================================
   * POINTER DOWN
   * =====================================
   */

  const handlePointerDown =
    useCallback(
      (
        event: CanvasPointerEvent
      ) => {

        const canvas =
          canvasRef.current;


        const context =
          contextRef.current;


        if (
          !canvas ||
          !context
        ) {
          return;
        }


        event.preventDefault();


        /*
         * Capture pointer.
         */

        canvas.setPointerCapture(
          event.pointerId
        );


        const point =
          getPoint(event);


        /*
         * =================================
         * ERASER
         * =================================
         */

        if (
          modeRef.current ===
          "stroke-eraser"
        ) {

          const previous =
            strokesRef.current;


          const filtered =
            previous.filter(
              (stroke) =>
                !strokeContainsPoint(
                  stroke,
                  point
                )
            );


          if (
            filtered.length !==
            previous.length
          ) {

            undoStackRef.current.push(
              previous.map(
                (stroke) => ({
                  ...stroke,

                  points:
                    stroke.points.map(
                      (p) => ({
                        ...p,
                      })
                    ),
                })
              )
            );


            redoStackRef.current =
              [];


            strokesRef.current =
              filtered;


            setCanUndo(true);

            setCanRedo(false);


            redrawCanvas();


            onStrokesChange?.(
              strokesRef.current
            );

          }


          return;
        }


        /*
         * =================================
         * PEN
         * =================================
         */

        isDrawingRef.current =
          true;


        lastPointRef.current =
          point;


        const stroke: Stroke = {

          id:
            createId(),

          points: [
            point,
          ],

          width:
            strokeWidthRef.current,

        };


        currentStrokeRef.current =
          stroke;


        /*
         * Draw first point.
         */

        context.fillStyle =
          "#ffffff";


        context.beginPath();


        context.arc(
          point.x,
          point.y,
          stroke.width / 2,
          0,
          Math.PI * 2
        );


        context.fill();

      },
      [
        getPoint,
        onStrokesChange,
        redrawCanvas,
      ]
    );


  /*
   * =====================================
   * POINTER MOVE
   *
   * PERFORMANCE CRITICAL SECTION
   *
   * No React state.
   * No DOM measurement.
   * No complete redraw.
   * =====================================
   */

  const handlePointerMove =
    useCallback(
      (
        event: CanvasPointerEvent
      ) => {

        if (
          !isDrawingRef.current
        ) {
          return;
        }


        const context =
          contextRef.current;


        const stroke =
          currentStrokeRef.current;


        if (
          !context ||
          !stroke
        ) {
          return;
        }


        event.preventDefault();


        /*
         * React's event contains the native
         * browser PointerEvent.
         */

        const nativeEvent =
          event.nativeEvent;


        /*
         * Use coalesced hardware samples
         * when the browser provides them.
         */

        const events =
          nativeEvent.getCoalescedEvents
            ? nativeEvent.getCoalescedEvents()
            : [nativeEvent];


        context.strokeStyle =
          "#ffffff";


        context.lineWidth =
          strokeWidthRef.current;


        context.lineCap =
          "round";


        context.lineJoin =
          "round";


        for (
          const pointerEvent
          of events
        ) {

          const rect =
            canvasRectRef.current;


          if (!rect) {
            continue;
          }


          const point: Point = {

            x:
              pointerEvent.clientX -
              rect.left,

            y:
              pointerEvent.clientY -
              rect.top,

          };


          const previous =
            lastPointRef.current;


          if (!previous) {

            lastPointRef.current =
              point;

            continue;

          }


          /*
           * Ignore extremely tiny movements.
           */

          if (
            distance(
              previous,
              point
            ) < 0.6
          ) {
            continue;
          }


          /*
           * Save point for recognition.
           */

          stroke.points.push(
            point
          );


          /*
           * Draw ONLY the new segment.
           */

          context.beginPath();


          context.moveTo(
            previous.x,
            previous.y
          );


          context.lineTo(
            point.x,
            point.y
          );


          context.stroke();


          lastPointRef.current =
            point;

        }

      },
      []
    );


  /*
   * =====================================
   * FINISH DRAWING
   * =====================================
   */

  const finishDrawing =
    useCallback(
      (
        event?: CanvasPointerEvent
      ) => {

        if (
          !isDrawingRef.current
        ) {
          return;
        }


        isDrawingRef.current =
          false;


        const stroke =
          currentStrokeRef.current;


        if (
          stroke &&
          stroke.points.length > 0
        ) {

          /*
           * Save current state for undo.
           */

          undoStackRef.current.push(
            strokesRef.current.map(
              (existing) => ({
                ...existing,

                points:
                  existing.points.map(
                    (point) => ({
                      ...point,
                    })
                  ),
              })
            )
          );


          /*
           * Limit history.
           */

          if (
            undoStackRef.current.length >
            50
          ) {

            undoStackRef.current.shift();

          }


          redoStackRef.current =
            [];


          /*
           * Add completed stroke.
           */

          strokesRef.current = [
            ...strokesRef.current,
            stroke,
          ];


          setCanUndo(true);

          setCanRedo(false);


          /*
           * Recognition only gets called
           * after the stroke has finished.
           */

          onStrokesChange?.(
            strokesRef.current
          );

        }


        currentStrokeRef.current =
          null;


        lastPointRef.current =
          null;


        /*
         * Release pointer capture.
         */

        if (
          event &&
          canvasRef.current
        ) {

          try {

            canvasRef.current
              .releasePointerCapture(
                event.pointerId
              );

          } catch {
            /*
             * Pointer may already have
             * been released.
             */
          }

        }

      },
      [onStrokesChange]
    );


  /*
   * =====================================
   * UNDO
   * =====================================
   */

  const undo =
    useCallback(() => {

      if (
        undoStackRef.current.length ===
        0
      ) {
        return;
      }


      redoStackRef.current.push(
        strokesRef.current.map(
          (stroke) => ({
            ...stroke,

            points:
              stroke.points.map(
                (point) => ({
                  ...point,
                })
              ),
          })
        )
      );


      const previous =
        undoStackRef.current.pop();


      strokesRef.current =
        previous || [];


      setCanUndo(
        undoStackRef.current.length >
        0
      );


      setCanRedo(true);


      redrawCanvas();


      onStrokesChange?.(
        strokesRef.current
      );

    }, [
      onStrokesChange,
      redrawCanvas,
    ]);


  /*
   * =====================================
   * REDO
   * =====================================
   */

  const redo =
    useCallback(() => {

      if (
        redoStackRef.current.length ===
        0
      ) {
        return;
      }


      undoStackRef.current.push(
        strokesRef.current.map(
          (stroke) => ({
            ...stroke,

            points:
              stroke.points.map(
                (point) => ({
                  ...point,
                })
              ),
          })
        )
      );


      const next =
        redoStackRef.current.pop();


      strokesRef.current =
        next || [];


      setCanUndo(true);


      setCanRedo(
        redoStackRef.current.length >
        0
      );


      redrawCanvas();


      onStrokesChange?.(
        strokesRef.current
      );

    }, [
      onStrokesChange,
      redrawCanvas,
    ]);


  /*
   * =====================================
   * CLEAR
   * =====================================
   */

  const clearCanvas =
    useCallback(() => {

      if (
        strokesRef.current.length ===
        0
      ) {
        return;
      }


      undoStackRef.current.push(
        strokesRef.current.map(
          (stroke) => ({
            ...stroke,

            points:
              stroke.points.map(
                (point) => ({
                  ...point,
                })
              ),
          })
        )
      );


      redoStackRef.current =
        [];


      strokesRef.current =
        [];


      setCanUndo(true);

      setCanRedo(false);


      redrawCanvas();


      onStrokesChange?.(
        []
      );

    }, [
      onStrokesChange,
      redrawCanvas,
    ]);


  /*
   * =====================================
   * MODE
   * =====================================
   */

  const changeMode =
    (
      newMode: DrawingMode
    ) => {

      modeRef.current =
        newMode;

      setMode(
        newMode
      );

    };


  /*
   * =====================================
   * PEN WIDTH
   * =====================================
   */

  const changeStrokeWidth =
    (
      value: number
    ) => {

      strokeWidthRef.current =
        value;

      setStrokeWidth(
        value
      );

    };


  /*
   * =====================================
   * KEYBOARD SHORTCUTS
   * =====================================
   */

  useEffect(() => {

    const handleKeyDown =
      (
        event: KeyboardEvent
      ) => {

        if (
          event.ctrlKey &&
          event.key.toLowerCase() ===
            "z"
        ) {

          event.preventDefault();

          undo();

          return;
        }


        if (
          event.ctrlKey &&
          event.key.toLowerCase() ===
            "y"
        ) {

          event.preventDefault();

          redo();

          return;
        }


        if (
          event.key ===
          "Escape"
        ) {

          changeMode(
            "pen"
          );

        }

      };


    window.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, [undo, redo]);


  /*
   * =====================================
   * INITIALIZE CANVAS
   * =====================================
   */

  useEffect(() => {

    resizeCanvas();


    const parent =
      canvasRef.current
        ?.parentElement;


    if (!parent) {
      return;
    }


    const resizeObserver =
      new ResizeObserver(
        () => {
          resizeCanvas();
        }
      );


    resizeObserver.observe(
      parent
    );


    window.addEventListener(
      "resize",
      resizeCanvas
    );


    return () => {

      resizeObserver.disconnect();

      window.removeEventListener(
        "resize",
        resizeCanvas
      );

    };

  }, [resizeCanvas]);


  /*
   * =====================================
   * UI
   * =====================================
   */

  return (
    <div className="drawing-canvas-container">

      <div className="drawing-toolbar">

        <div className="drawing-tools">

          <button
            type="button"
            className={
              mode === "pen"
                ? "drawing-tool active"
                : "drawing-tool"
            }
            onClick={() =>
              changeMode("pen")
            }
          >
            ✎ Pen
          </button>


          <button
            type="button"
            className={
              mode === "stroke-eraser"
                ? "drawing-tool active"
                : "drawing-tool"
            }
            onClick={() =>
              changeMode(
                "stroke-eraser"
              )
            }
          >
            ⌫ Eraser
          </button>


          <button
            type="button"
            className="drawing-tool"
            onClick={undo}
            disabled={!canUndo}
          >
            ↶ Undo
          </button>


          <button
            type="button"
            className="drawing-tool"
            onClick={redo}
            disabled={!canRedo}
          >
            ↷ Redo
          </button>


          <button
            type="button"
            className="drawing-tool clear-tool"
            onClick={clearCanvas}
          >
            □ Clear
          </button>

        </div>


        <div className="pen-size">

          <span>
            Stroke
          </span>


          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={strokeWidth}
            onChange={(event) =>
              changeStrokeWidth(
                Number(
                  event.target.value
                )
              )
            }
          />


          <span>
            {strokeWidth}
          </span>

        </div>

      </div>


      <canvas
        ref={canvasRef}

        onPointerDown={
          handlePointerDown
        }

        onPointerMove={
          handlePointerMove
        }

        onPointerUp={
          finishDrawing
        }

        onPointerCancel={
          finishDrawing
        }
      />

    </div>
  );
}


export default DrawingCanvas;