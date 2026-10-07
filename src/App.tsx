import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";

import DrawingCanvas from "./canvas/DrawingCanvas";

import type {
  Stroke,
} from "./types/stroke";

import {
  initializeRecognition,
  recognizeStrokes,
  disposeRecognition,
} from "./recognition/engine";

import {
  evaluateExpression,
} from "./math/parser";


type HistoryItem = {
  expression: string;
  result: string;
};


function formatExpression(
  expression: string
): string {
  return expression
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/−/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}


function App() {

  const [
    recognizedText,
    setRecognizedText,
  ] = useState("");

  const [
    calculatedResult,
    setCalculatedResult,
  ] = useState("");

  const [
    recognizing,
    setRecognizing,
  ] = useState(false);

  const [
    modelReady,
    setModelReady,
  ] = useState(false);

  const [
    history,
    setHistory,
  ] = useState<HistoryItem[]>([]);

  const [
    angleMode,
    setAngleMode,
  ] = useState<"DEG" | "RAD">("DEG");


  const recognitionTimerRef =
    useRef<number | null>(null);

  const recognitionRequestRef =
    useRef(0);


  /*
   * ========================================
   * LOAD MODEL
   * ========================================
   */

  useEffect(() => {

    let cancelled = false;


    const loadModel =
      async () => {

        try {

          await initializeRecognition();


          if (!cancelled) {
            setModelReady(true);
          }

        } catch (error) {

          console.error(
            "Failed to load handwriting recognition model:",
            error
          );

        }

      };


    loadModel();


    return () => {

      cancelled = true;


      if (
        recognitionTimerRef.current !==
        null
      ) {

        window.clearTimeout(
          recognitionTimerRef.current
        );

      }


      disposeRecognition();

    };

  }, []);


  /*
   * ========================================
   * RECOGNITION
   * ========================================
   */

  const handleStrokesChange =
    (
      newStrokes: Stroke[]
    ) => {

      if (
        recognitionTimerRef.current !==
        null
      ) {

        window.clearTimeout(
          recognitionTimerRef.current
        );

      }


      if (
        newStrokes.length === 0
      ) {

        setRecognizedText("");
        setCalculatedResult("");

        return;
      }


      /*
       * Wait until the user stops writing.
       *
       * This is NOT involved in canvas
       * rendering.
       */

      recognitionTimerRef.current =
        window.setTimeout(
          async () => {

            const requestId =
              ++recognitionRequestRef.current;


            try {

              setRecognizing(true);


              const result =
                await recognizeStrokes(
                  newStrokes
                );


              /*
               * Ignore old results.
               */

              if (
                requestId !==
                recognitionRequestRef.current
              ) {
                return;
              }


              if (!result) {

                setRecognizedText("");
                setCalculatedResult("");

                return;
              }


              const recognized =
                formatExpression(
                  result.latex
                );


              setRecognizedText(
                recognized
              );


              const calculation =
                evaluateExpression(
                  recognized
                );


              if (
                calculation.success
              ) {

                const resultText =
                  String(
                    calculation.value
                  );


                setCalculatedResult(
                  resultText
                );


                setHistory(
                  (previous) => {

                    const exists =
                      previous.some(
                        (item) =>
                          item.expression ===
                            recognized &&
                          item.result ===
                            resultText
                      );


                    if (exists) {
                      return previous;
                    }


                    return [
                      {
                        expression:
                          recognized,

                        result:
                          resultText,
                      },

                      ...previous,
                    ].slice(0, 5);

                  }
                );

              } else {

                setCalculatedResult(
                  calculation.error
                );

              }

            } catch (error) {

              console.error(
                "Recognition failed:",
                error
              );


              setRecognizedText("");
              setCalculatedResult("");

            } finally {

              if (
                requestId ===
                recognitionRequestRef.current
              ) {

                setRecognizing(
                  false
                );

              }

            }

          },

          900
        );

    };


  return (
    <div className="calcink-app">

      {/* ==================================
          TOP BAR
      =================================== */}

      <header className="topbar">

        <div className="brand-section">

          <div className="brand-logo">
            ∑
          </div>


          <div className="brand-name">
            Calc<span>Ink</span>
          </div>


          <div className="brand-divider" />


          <div className="brand-description">
            The handwritten calculator
          </div>

        </div>


        <div className="topbar-right">

          <div className="save-status">

            <span className="save-dot" />

            {modelReady
              ? "Model ready"
              : "Loading model..."}

          </div>


          <div className="angle-toggle">

            <button
              className={
                angleMode === "DEG"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAngleMode("DEG")
              }
            >
              DEG
            </button>


            <button
              className={
                angleMode === "RAD"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAngleMode("RAD")
              }
            >
              RAD
            </button>

          </div>


          <button className="avatar">
            JD
          </button>

        </div>

      </header>


      {/* ==================================
          HERO
      =================================== */}

      <section className="hero">

        <div>

          <h1>
            A space to work it out.
            <span className="pencil-icon">
              ✎
            </span>
          </h1>


          <p>
            Write naturally. We'll take care
            of the numbers.
          </p>

        </div>


        <div className="hero-status">

          <span className="hero-status-dot" />

          {recognizing
            ? "Recognizing expression..."
            : "Ready to calculate"}

        </div>

      </section>


      {/* ==================================
          MAIN
      =================================== */}

      <main className="main-content">

        {/* LEFT */}

        <section className="workspace-column">

          <div className="workspace-card">

            <div className="workspace-label">
              <span className="tiny-dot" />
              BOARD 01 / FREEFORM
            </div>


            <div className="drawing-wrapper">

              <DrawingCanvas
                onStrokesChange={
                  handleStrokesChange
                }
              />

            </div>


            <div className="workspace-footer">

              <span>
                Sketch with your mouse or tablet
              </span>


              <span>
                {recognizing
                  ? "Recognizing..."
                  : "Waiting for input"}
              </span>

            </div>

          </div>


          {/* EXAMPLES */}

          <section className="examples-section">

            <div className="section-heading">

              <div>

                <h3>
                  A little inspiration
                </h3>


                <p>
                  Choose an expression to try
                </p>

              </div>

            </div>


            <div className="examples-grid">

              <button className="example-card">
                <strong>
                  2 + 3
                </strong>

                <span>
                  Arithmetic
                </span>
              </button>


              <button className="example-card">
                <strong>
                  √(81) + 6
                </strong>

                <span>
                  Roots
                </span>
              </button>


              <button className="example-card">
                <strong>
                  sin(30°)
                </strong>

                <span>
                  Trigonometry
                </span>
              </button>


              <button className="example-card">
                <strong>
                  ½ + ¾
                </strong>

                <span>
                  Fractions
                </span>
              </button>


              <button className="example-card">
                <strong>
                  ∫ x² dx
                </strong>

                <span>
                  Calculus
                </span>
              </button>

            </div>

          </section>

        </section>


        {/* RIGHT */}

        <aside className="right-panel">

          {/* RECOGNITION */}

          <section className="panel-card">

            <div className="panel-header">

              <div>

                <span className="panel-eyebrow">
                  Recognized expression
                </span>


                <div className="recognition-title">

                  {recognizedText ||
                    "Start writing..."}

                </div>

              </div>


              <div className="confidence">

                {recognizing
                  ? "..."
                  : recognizedText
                    ? "✓ 99%"
                    : "—"}

              </div>

            </div>


            <div className="recognition-divider" />


            <div className="recognition-info">

              <span className="recognition-icon">
                ✎
              </span>

              {modelReady
                ? "On-device recognition"
                : "Loading recognition model"}

            </div>

          </section>


          {/* RESULT */}

          <section className="panel-card result-card">

            <div className="panel-header">

              <span className="panel-eyebrow">
                Result
              </span>


              <span className="copy-icon">
                ⧉
              </span>

            </div>


            <div className="result-value">
              {calculatedResult || "—"}
            </div>


            <p className="result-description">

              {calculatedResult
                ? "Exact answer · Real number"
                : "Write an expression to calculate"}

            </p>

          </section>


          {/* STEPS */}

          <section className="panel-card">

            <div className="steps-header">

              <strong>
                Step by step
              </strong>

              <span>
                ⌃
              </span>

            </div>


            {recognizedText &&
            calculatedResult ? (

              <div className="steps-list">

                <div className="step">

                  <span className="step-number">
                    1
                  </span>


                  <div>

                    <small>
                      Evaluate expression
                    </small>


                    <strong>
                      {recognizedText}
                    </strong>

                  </div>

                </div>


                <div className="step">

                  <span className="step-number">
                    2
                  </span>


                  <div>

                    <small>
                      Calculate
                    </small>


                    <strong>
                      {recognizedText} ={" "}
                      {calculatedResult}
                    </strong>

                  </div>

                </div>

              </div>

            ) : (

              <div className="empty-steps">
                Steps will appear here
                after recognition.
              </div>

            )}

          </section>


          {/* HISTORY */}

          <section className="panel-card history-card">

            <div className="history-header">

              <div>

                <strong>
                  History
                </strong>


                <span className="history-count">
                  {history.length
                    .toString()
                    .padStart(2, "0")}
                </span>

              </div>


              <button
                onClick={() =>
                  setHistory([])
                }
                disabled={
                  history.length === 0
                }
              >
                Clear all
              </button>

            </div>


            <div className="history-list">

              {history.length === 0 ? (

                <div className="history-empty">
                  Your calculations
                  will appear here.
                </div>

              ) : (

                history.map(
                  (item, index) => (

                    <div
                      className="history-item"
                      key={`${item.expression}-${index}`}
                    >

                      <div>

                        <strong>
                          {item.expression}
                        </strong>

                        <small>
                          Just now
                        </small>

                      </div>


                      <span>
                        {item.result}
                      </span>

                    </div>

                  )
                )

              )}

            </div>

          </section>

        </aside>

      </main>


      {/* FOOTER */}

      <footer className="bottom-footer">

        <span>
          Less typing. More thinking.
        </span>


        <div>

          <span>
            Your sketches stay yours
          </span>


          <span>
            Help & shortcuts ↗
          </span>

        </div>

      </footer>

    </div>
  );
}


export default App;