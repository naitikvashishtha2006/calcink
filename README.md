# CalcInk — On-Device Handwritten Math Calculator

CalcInk is a responsive web-based digital notebook that allows users to write
mathematical expressions using a mouse, stylus, or touch input.

The application captures handwritten strokes, recognizes the mathematical
expression directly in the browser, evaluates the expression using a
deterministic math parser, and displays the calculated result.

The application is designed to run entirely on-device without sending
handwriting data to a remote server.

---

## Features

### Handwriting Canvas

- Mouse, stylus, and touch input
- Smooth real-time drawing
- High-DPI / Retina canvas support
- Adjustable stroke width
- Pen mode
- Stroke eraser
- Undo
- Redo
- Clear canvas
- Responsive canvas layout

### Handwriting Recognition

CalcInk uses a pretrained handwritten mathematical expression recognition
model running locally in the browser.

Supported mathematical vocabulary includes:

- Digits `0–9`
- Addition `+`
- Subtraction `−`
- Multiplication `×`
- Division `÷`
- Decimal `.`
- Terminal `=`

Recognition is performed using ONNX Runtime Web.

### Mathematical Evaluation

CalcInk includes a deterministic mathematical expression parser supporting:

- Operator precedence (BODMAS / PEMDAS)
- Multi-digit numbers
- Decimal numbers
- Negative numbers
- Addition
- Subtraction
- Multiplication
- Division
- Division-by-zero handling
- Invalid-expression handling

The application does not use JavaScript `eval()` for evaluating user input.

### On-Device Processing

The recognition model is stored locally with the application:

```text
public/models/comer/
├── encoder_int8.onnx
├── decoder_int8.onnx
└── vocab.json
