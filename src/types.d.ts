declare module "threejs-components/build/cursors/tubes1.min.js" {
  interface TubesCursor {
    tubes: {
      setColors(colors: string[]): void;
      setLightsColors(colors: string[]): void;
    };
    dispose?: () => void;
  }
  export default function createTubesCursor(canvas: HTMLCanvasElement, options?: unknown): TubesCursor;
}
