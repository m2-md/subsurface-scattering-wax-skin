interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  readonly available: boolean;
  readonly samplesMs: number[] = [];
  private readonly ext: TimerExtension | null;
  private readonly pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    ) as TimerExtension | null;
    this.available = this.ext !== null;
  }

  begin(): void {
    if (!this.ext || this.active) return; // only one query can be open at once
    this.active = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  poll(): void {
    if (!this.ext) return;
    const { gl } = this;
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      this.pending.length = 0; // GPU clock disjoint: everything in hand is junk
      return;
    }
    while (this.pending.length > 0) {
      const query = this.pending[0];
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      this.samplesMs.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query);
      this.pending.shift();
    }
  }

  /** Drop the accumulated samples when switching to a new configuration. */
  reset(): void {
    this.samplesMs.length = 0;
  }

  dispose(): void {
    if (!this.ext) return;
    if (this.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.pending.push(this.active);
      this.active = null;
    }
    for (const query of this.pending) this.gl.deleteQuery(query);
    this.pending.length = 0;
  }
}
