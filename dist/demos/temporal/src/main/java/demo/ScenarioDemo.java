package demo;
import io.temporal.client.*;
import java.util.concurrent.TimeUnit;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String id = Env.get("DEMO_WORKFLOW_ID", "demo-agent-research-001");
    try (var support = new TemporalSupport()) {
      var workflow = support.newRun(id);
      try {
        var execution = WorkflowClient.start(workflow::run, id);
        System.out.println("START " + execution.getWorkflowId());
      } catch (WorkflowExecutionAlreadyStarted existing) {
        System.out.println("EXISTING " + id);
        workflow = support.client.newWorkflowStub(DemoWorkflow.class, id);
      }
      String result = WorkflowStub.fromTyped(workflow).getResult(90, TimeUnit.SECONDS, String.class);
      System.out.println(result);
    }
  }
}
