package demo;
import io.opentelemetry.context.Scope;
public class CoreDemo {
  public static void main(String[] args) {
    try (var telemetry = new Telemetry()) {
      var parent = telemetry.tracer.spanBuilder("core-parent").startSpan();
      try (Scope scope = parent.makeCurrent()) {
        telemetry.step("core-success", () -> "ok");
        try {
          telemetry.step("core-failure", () -> { throw new IllegalStateException("演示异常"); });
        } catch (IllegalStateException expected) {
          parent.addEvent("child failure handled");
          System.out.println("预期错误已捕获，查看失败子 Span");
        }
        System.out.println("traceId=" + parent.getSpanContext().getTraceId());
      } finally { parent.end(); }
    }
  }
}
