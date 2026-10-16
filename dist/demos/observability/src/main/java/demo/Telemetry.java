package demo;
import io.opentelemetry.api.common.*;
import io.opentelemetry.api.trace.*;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.*;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import io.opentelemetry.exporter.logging.LoggingSpanExporter;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.context.Scope;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
public final class Telemetry implements AutoCloseable {
  final SdkTracerProvider provider;
  final Tracer tracer;
  Telemetry() {
    var builder = SdkTracerProvider.builder().setSampler(Sampler.alwaysOn())
      .setResource(Resource.create(Attributes.of(AttributeKey.stringKey("service.name"), "demo-agent-java")))
      .addSpanProcessor(SimpleSpanProcessor.create(LoggingSpanExporter.create()));
    String endpoint = Env.get("DEMO_OTLP_ENDPOINT", "");
    if (!endpoint.isBlank()) {
      var exporter = OtlpHttpSpanExporter.builder().setEndpoint(endpoint)
        .setTimeout(Duration.ofSeconds(5));
      String authorization = Env.get("DEMO_OTLP_AUTHORIZATION", "");
      if (!authorization.isBlank()) exporter.addHeader("Authorization", authorization);
      builder.addSpanProcessor(BatchSpanProcessor.builder(exporter.build()).build());
    }
    provider = builder.build();
    var sdk = OpenTelemetrySdk.builder().setTracerProvider(provider).build();
    tracer = sdk.getTracer("demo.agent", "1.0.0");
  }
  <T> T step(String name, Supplier<T> action) {
    Span span = tracer.spanBuilder(name).startSpan();
    try (Scope scope = span.makeCurrent()) {
      return action.get();
    } catch (RuntimeException failure) {
      span.recordException(failure);
      span.setStatus(StatusCode.ERROR, failure.getClass().getSimpleName());
      throw failure;
    } finally { span.end(); }
  }
  public void close() {
    var flushed = provider.forceFlush().join(10, TimeUnit.SECONDS);
    System.out.println("flush success=" + flushed.isSuccess());
    provider.shutdown().join(10, TimeUnit.SECONDS);
  }
}
