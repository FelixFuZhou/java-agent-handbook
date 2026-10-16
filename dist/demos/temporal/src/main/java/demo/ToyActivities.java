package demo;
import io.temporal.activity.Activity;
public class ToyActivities implements DemoActivities {
  public String execute(String taskId, String step) {
    int attempt = Activity.getExecutionContext().getInfo().getAttempt();
    System.out.printf("task=%s step=%s attempt=%d%n", taskId, step, attempt);
    if (step.equals("retrieve") && attempt == 1 &&
        Boolean.parseBoolean(Env.get("DEMO_ACTIVITY_FAIL_ONCE", "true")))
      throw new IllegalStateException("演示：检索服务暂时不可用");
    // 模拟可中断的外部耗时，真实网络调用应有自己的请求超时。
    try { Thread.sleep(2000); }
    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw Activity.wrap(e); }
    // 这里没有真实模型，也没有外部写入；生产工具需持久幂等。
    return step.equals("retrieve") ? "evidence:doc-101:v2" : "report:" + taskId;
  }
}
