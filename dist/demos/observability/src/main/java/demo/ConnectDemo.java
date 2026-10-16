package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var telemetry = new Telemetry()) {
      var span = telemetry.tracer.spanBuilder("demo.connect").startSpan();
      try {
        span.setAttribute("app.demo", true);
        System.out.println("traceId=" + span.getSpanContext().getTraceId());
      } finally { span.end(); }
    }
  }
}
