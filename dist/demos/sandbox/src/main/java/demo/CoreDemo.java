package demo;
import java.time.Duration;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var denied = ContainerRunner.python("open('/blocked.txt', 'w').write('x')", "", Duration.ofSeconds(10));
    System.out.println("只读文件系统演示 exit=" + denied.exitCode());
    System.out.println(denied.output());
    if (denied.exitCode() == 0) throw new IllegalStateException("未观察到预期的文件系统隔离");
    try {
      ContainerRunner.python("import time; time.sleep(30)", "", Duration.ofSeconds(2));
      throw new AssertionError("超时未触发");
    } catch (IllegalStateException expected) { System.out.println(expected.getMessage()); }
  }
}
