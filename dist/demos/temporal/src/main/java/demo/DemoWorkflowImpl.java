package demo;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import io.temporal.workflow.Workflow;
import java.time.Duration;
public class DemoWorkflowImpl implements DemoWorkflow {
  private final DemoActivities activities = Workflow.newActivityStub(DemoActivities.class,
    ActivityOptions.newBuilder()
      .setStartToCloseTimeout(Duration.ofSeconds(10))
      .setScheduleToCloseTimeout(Duration.ofSeconds(40))
      .setRetryOptions(RetryOptions.newBuilder().setMaximumAttempts(3)
        .setInitialInterval(Duration.ofSeconds(1)).build()).build());
  public String run(String taskId) {
    String evidence = activities.execute(taskId, "retrieve");
    Workflow.sleep(Duration.ofSeconds(1));
    String report = activities.execute(taskId, "report");
    return report + " | " + evidence;
  }
}
