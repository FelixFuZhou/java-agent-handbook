package demo;
import java.nio.file.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    Path input = Path.of(Env.required("JOB_FILE"));
    if (Files.size(input) > 65536) throw new IllegalArgumentException("示例任务文件不能超过 64 KiB");
    String tenant = Env.required("WORKER_TENANT");
    String job = Files.readString(input);
    System.out.println("tenant=" + tenant + " job=" + job);
    System.out.println("输入已读取；此示例仅验证容器配置与挂载，没有执行真实文档入库。");
    // 真正 Worker 在这里解析/校验任务、检查幂等记录、执行入库，提交状态后再确认队列消息。
  }
}
