declare module 'd2' {
    export function render(code: string, format: string): Promise<Buffer>;
  }