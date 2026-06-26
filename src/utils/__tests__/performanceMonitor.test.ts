import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceMonitor } from "../performanceMonitor";

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it("returns 0 fps before any frame data", () => {
    expect(monitor.getFps()).toBe(0);
  });

  it("records and reports frame times correctly", () => {
    monitor.reset();

    // Use real timestamps starting from reset's lastStatsUpdate
    let now = performance.now();

    // First call initializes lastFrameTime
    now += 16;
    monitor.addFrameTime(now);

    // Inject many frames at ~16ms intervals to build up to and past the 1s stats update window
    for (let i = 0; i < 70; i++) {
      now += 16;
      monitor.addFrameTime(now);
    }

    const stats = monitor.getStats();
    expect(stats.avgFrameTime).toBeGreaterThan(0);
    expect(stats.fps).toBeGreaterThanOrEqual(50);
    expect(stats.fps).toBeLessThanOrEqual(70);
  });

  it("resets correctly", () => {
    monitor.addFrameTime(performance.now());
    monitor.reset();
    expect(monitor.getFps()).toBe(0);
  });

  it("handles abnormal gaps (tab hidden) gracefully", () => {
    const now = performance.now();
    monitor.addFrameTime(now);
    // Simulate a 10-second gap (tab was hidden)
    monitor.addFrameTime(now + 10000);
    // Should have filtered out the abnormal frame
    expect(monitor.getFps()).toBe(0);
  });

  it("produces a performance report string", () => {
    const report = PerformanceMonitor.createPerformanceReport();
    expect(report).toContain("Performance Report");
  });

  it("logPerformanceMark and logPerformanceMeasure do not throw", () => {
    expect(() => PerformanceMonitor.logPerformanceMark("test-mark")).not.toThrow();
    expect(() =>
      PerformanceMonitor.logPerformanceMeasure("test-mark", "test-mark", "test-measure"),
    ).not.toThrow();
  });
});
