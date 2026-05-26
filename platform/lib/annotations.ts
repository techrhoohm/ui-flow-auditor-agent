export interface ManualAnnotation {
  id: string;
  shape: 'rect' | 'ellipse';
  /** 0–100: percentage of the image/wireframe width */
  x: number;
  /** 0–100: percentage of the image/wireframe height */
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
}
