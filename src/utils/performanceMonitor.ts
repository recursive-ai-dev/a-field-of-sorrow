export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private maxFrameTimes: number = 60;
  private lastFpsUpdate: number = 0;
  private fpsUpdateInterval: number = 1000; // Update FPS every second
  
  private stats: {
    fps: number;
    avgFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
    frameTimeVariance: number;
  } = {
    fps: 0,
    avgFrameTime: 0,
    minFrameTime: Infinity,
    maxFrameTime: 0,
    frameTimeVariance: 0
  };

  constructor() {
    this.reset();
  }

  startFrame(): void {
    // This would be called at the start of each frame
    // For now, we'll just track frame times
  }

  endFrame(): void {
    // This would be called at the end of each frame
    // For now, we'll just track frame times
  }

  addFrameTime(frameTime: number): void {
    const now = performance.now();
    
    // Add frame time to our buffer
    this.frameTimes.push(frameTime);
    
    // Keep buffer size manageable
    if (this.frameTimes.length > this.maxFrameTimes) {
      this.frameTimes.shift();
    }
    
    // Update stats periodically
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.updateStats();
      this.lastFpsUpdate = now;
    }
  }

  private updateStats(): void {
    if (this.frameTimes.length === 0) {
      this.stats = {
        fps: 0,
        avgFrameTime: 0,
        minFrameTime: 0,
        maxFrameTime: 0,
        frameTimeVariance: 0
      };
      return;
    }
    
    // Calculate average frame time
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    const avgFrameTime = sum / this.frameTimes.length;
    
    // Calculate FPS (frames per second)
    const fps = 1000 / avgFrameTime;
    
    // Calculate min and max frame times
    const minFrameTime = Math.min(...this.frameTimes);
    const maxFrameTime = Math.max(...this.frameTimes);
    
    // Calculate variance
    const variance = this.frameTimes.reduce((sum, time) => {
      return sum + Math.pow(time - avgFrameTime, 2);
    }, 0) / this.frameTimes.length;
    
    this.stats = {
      fps: Math.round(fps),
      avgFrameTime: parseFloat(avgFrameTime.toFixed(2)),
      minFrameTime: parseFloat(minFrameTime.toFixed(2)),
      maxFrameTime: parseFloat(maxFrameTime.toFixed(2)),
      frameTimeVariance: parseFloat(variance.toFixed(2))
    };
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  getFps(): number {
    return this.stats.fps;
  }

  reset(): void {
    this.frameTimes = [];
    this.stats = {
      fps: 0,
      avgFrameTime: 0,
      minFrameTime: Infinity,
      maxFrameTime: 0,
      frameTimeVariance: 0
    };
    this.lastFpsUpdate = performance.now();
  }

  static createPerformanceReport(): string {
    if (typeof performance === 'undefined') {
      return "Performance API not available";
    }
    
    const memory = performance.memory;
    const report: string[] = [];
    
    report.push(`=== Performance Report ===`);
    report.push(`Timestamp: ${new Date().toISOString()}`);
    
    if (memory) {
      report.push(`Memory Usage:`);
      report.push(`  JS Heap Size: ${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`);
      report.push(`  Used Heap Size: ${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
      report.push(`  Total Heap Size: ${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`);
    }
    
    if (navigator.deviceMemory) {
      report.push(`Device Memory: ${navigator.deviceMemory} GB`);
    }
    
    if (navigator.hardwareConcurrency) {
      report.push(`Logical Processors: ${navigator.hardwareConcurrency}`);
    }
    
    return report.join('\n');
  }

  static logPerformanceMark(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(name);
    }
  }

  static logPerformanceMeasure(startMark: string, endMark: string, name: string): void {
    if (typeof performance !== 'undefined') {
      try {
        performance.measure(name, startMark, endMark);
        const measures = performance.getEntriesByName(name);
        if (measures.length > 0) {
          console.log(`${name}: ${measures[0].duration.toFixed(2)}ms`);
        }
      } catch (error) {
        console.warn(`Failed to measure performance: ${error}`);
      }
    }
  }
}
