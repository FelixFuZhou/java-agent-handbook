package demo;
import io.opentelemetry.api.trace.*;
import io.opentelemetry.context.*;
import java.util.*;
import java.util.concurrent.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    Env.required("DEMO_OTLP_ENDPOINT");
    ExecutorService pool = Executors.newSingleThreadExecutor();
    try (var telemetry = new Telemetry()) {
      String taskId = "demo-task-" + UUID.randomUUID();
      Span root = telemetry.tracer.spanBuilder("agent.request").startSpan();
      try (Scope scope = root.makeCurrent()) {
        root.setAttribute("app.task.id", taskId);
        System.out.println("taskId=" + taskId + " traceId=" + root.getSpanContext().getTraceId());
        String evidence = telemetry.step("retrieval", () -> {
          Span.current().setAttribute("app.retrieval.chunk_id", "demo-policy-v2");
          Span.current().setAttribute("app.retrieval.count", 1L);
          return "演示制度片段";
        });
        String answer = telemetry.step("generation", () -> {
          Span.current().setAttribute("app.model", "toy-no-model-call");
          Span.current().setAttribute("app.prompt.version", "demo-v1");
          return "根据固定资料生成的教学回答: " + evidence;
        });
        Callable<String> action = () -> telemetry.step("tool", () -> {
          Span.current().setAttribute("app.tool.name", "demo.createDraft");
          if (Boolean.parseBoolean(Env.get("DEMO_TOOL_FAIL", "true")))
            throw new IllegalStateException("演示工具失败，没有执行真实写操作");
          return "toy draft created";
        });
        try {
          String result = pool.submit(Context.current().wrap(action)).get(10, TimeUnit.SECONDS);
          System.out.println(answer + " | " + result);
        } catch (ExecutionException expected) {
          root.recordException(expected.getCause());
          root.setStatus(StatusCode.ERROR, "tool_failed");
          System.out.println("任务未完成：默认工具失败演示");
        }
      } catch (Exception failure) {
        root.recordException(failure);
        root.setStatus(StatusCode.ERROR);
        throw failure;
      } finally { root.end(); }
    } finally { pool.shutdownNow(); }
  }
}
