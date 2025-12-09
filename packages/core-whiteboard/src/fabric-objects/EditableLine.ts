import { fabric } from 'fabric';

// Custom render function for controls
function renderCircleControl(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number
) {
  const size = 8;
  ctx.save();
  ctx.translate(left, top);
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Position handler for controls
function linePositionHandler(
  this: fabric.Control,
  dim: unknown,
  finalMatrix: number[],
  fabricObject: fabric.Line
) {
  const point = fabricObject.calcLinePoints();
  const actionName = this.actionName as string;
  const pointToUse = actionName.includes('p1')
    ? new fabric.Point(point.x1, point.y1)
    : new fabric.Point(point.x2, point.y2);
  return fabric.util.transformPoint(
    pointToUse,
    fabricObject.calcTransformMatrix()
  );
}

// Action handler for controls
function lineActionHandler(
  eventData: MouseEvent,
  transform: fabric.Transform,
  x: number,
  y: number
) {
  const line = transform.target as fabric.Line;
  const actionName = transform.action as string;

  // Get current absolute positions of both endpoints
  const points = line.calcLinePoints();
  const matrix = line.calcTransformMatrix();

  const p1 = fabric.util.transformPoint(
    new fabric.Point(points.x1, points.y1),
    matrix
  );
  const p2 = fabric.util.transformPoint(
    new fabric.Point(points.x2, points.y2),
    matrix
  );

  // Update the appropriate endpoint with the new canvas position
  if (actionName.includes('p1')) {
    p1.x = x;
    p1.y = y;
  } else {
    p2.x = x;
    p2.y = y;
  }

  // Calculate new center and relative positions
  const newCenterX = (p1.x + p2.x) / 2;
  const newCenterY = (p1.y + p2.y) / 2;

  const newX1 = p1.x - newCenterX;
  const newY1 = p1.y - newCenterY;
  const newX2 = p2.x - newCenterX;
  const newY2 = p2.y - newCenterY;

  // Update line
  line.set({
    x1: newX1,
    y1: newY1,
    x2: newX2,
    y2: newY2,
    left: newCenterX,
    top: newCenterY,
  });

  line.setCoords();
  line.fire('modified');
  return true;
}

// Create custom controls
const p1Control = new fabric.Control({
  positionHandler: linePositionHandler,
  actionHandler: lineActionHandler,
  actionName: 'p1_action',
  cursorStyle: 'pointer',
  render: renderCircleControl,
});

const p2Control = new fabric.Control({
  positionHandler: linePositionHandler,
  actionHandler: lineActionHandler,
  actionName: 'p2_action',
  cursorStyle: 'pointer',
  render: renderCircleControl,
});

/**
 * EditableLine - A line with editable endpoints
 * Extended from Fabric.js Line with custom controls
 */
export const EditableLine = fabric.util.createClass(fabric.Line, {
  type: 'editableLine',

  hasBorders: false,
  hasControls: true,

  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,

  lockMovementX: false,
  lockMovementY: false,

  strokeUniform: true,

  perPixelTargetFind: true,

  initialize(points: number[], options: fabric.ILineOptions) {
    this.callSuper('initialize', points, options);

    this.controls = {
      p1: p1Control,
      p2: p2Control,
    };
  },
});

// Add the custom class to fabric's namespace
(fabric as typeof fabric & { EditableLine: typeof EditableLine }).EditableLine =
  EditableLine;

// Implement fromObject for serialization/deserialization
EditableLine.fromObject = function (
  object: Record<string, unknown>,
  callback?: (obj: fabric.Object) => void
) {
  const points = [
    object.x1 as number,
    object.y1 as number,
    object.x2 as number,
    object.y2 as number,
  ];
  const line = new EditableLine(points, object);
  if (callback) {
    callback(line);
  }
  return line;
};

/**
 * Register EditableLine for deserialization
 */
export function registerEditableLine() {
  (fabric as typeof fabric & { EditableLine: typeof EditableLine }).EditableLine =
    EditableLine;
}
