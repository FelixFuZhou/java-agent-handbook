package demo;
import java.time.Duration;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var result = ContainerRunner.python("print('sandbox ready')", "", Duration.ofSeconds(10));
    System.out.println("exit=" + result.exitCode() + " output=" + result.output());
    if (result.exitCode() != 0) throw new IllegalStateException("沙箱未成功启动");
  }
}
