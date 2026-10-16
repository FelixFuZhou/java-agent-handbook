package demo;
import io.temporal.client.*;
import io.temporal.serviceclient.*;
import io.temporal.api.enums.v1.WorkflowIdReusePolicy;
import java.time.Duration;
public final class TemporalSupport implements AutoCloseable {
  final WorkflowServiceStubs service;
  final WorkflowClient client;
  TemporalSupport() {
    service = WorkflowServiceStubs.newServiceStubs(WorkflowServiceStubsOptions.newBuilder()
      .setTarget(Env.get("TEMPORAL_TARGET", "localhost:7233")).build());
    client = WorkflowClient.newInstance(service, WorkflowClientOptions.newBuilder()
      .setNamespace(Env.get("TEMPORAL_NAMESPACE", "default")).build());
  }
  static String queue() { return Env.get("DEMO_TEMPORAL_QUEUE", "demo-agent-research"); }
  DemoWorkflow newRun(String id) {
    if (!id.startsWith("demo-")) throw new IllegalArgumentException("要求 demo- 工作流 ID");
    return client.newWorkflowStub(DemoWorkflow.class, WorkflowOptions.newBuilder()
      .setTaskQueue(queue()).setWorkflowId(id)
      .setWorkflowExecutionTimeout(Duration.ofMinutes(2))
      .setWorkflowIdReusePolicy(WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE)
      .build());
  }
  public void close() { service.shutdown(); }
}
