import 'fabric';

declare module 'fabric' {
  namespace fabric {
    class EditableLine extends fabric.Line {
      // Add custom properties or methods if needed
    }
    interface EditableLineConstructor {
      new(points: number[], options?: fabric.ILineOptions): EditableLine;
      fromObject(object: Record<string, unknown>, callback?: (obj: EditableLine) => void): EditableLine | void;
    }
    const EditableLine: EditableLineConstructor;
  }
}
