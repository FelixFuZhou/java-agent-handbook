package demo;
import io.temporal.activity.ActivityInterface;
@ActivityInterface
public interface DemoActivities {
  String execute(String taskId, String step);
}
