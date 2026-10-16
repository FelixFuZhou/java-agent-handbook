package demo;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;
@WorkflowInterface
public interface DemoWorkflow {
  @WorkflowMethod String run(String taskId);
}
