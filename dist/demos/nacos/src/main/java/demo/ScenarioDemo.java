package demo;
import com.alibaba.nacos.api.config.listener.Listener;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var service = NacosSupport.connect();
    var active = new AtomicReference<NacosSupport.Policy>();
    var rejected = new CountDownLatch(1);
    var applied = new CountDownLatch(1);
    Listener listener = new Listener() {
      public Executor getExecutor() { return null; }
      public void receiveConfigInfo(String content) {
        try {
          var policy = NacosSupport.parse(content);
          active.set(policy);
          System.out.println("APPLIED " + policy);
          if (policy.version().equals("demo-v2")) applied.countDown();
        } catch (Exception invalid) {
          System.out.println("REJECTED " + invalid.getMessage());
          rejected.countDown(); // 不覆盖 active，保持最后一个有效策略。
        }
      }
    };
    try {
      NacosSupport.publish(service, NacosSupport.SCENARIO, NacosSupport.content(3, "demo-v1"));
      String initial = service.getConfigAndSignListener(
        NacosSupport.SCENARIO, NacosSupport.GROUP, 5000, listener);
      active.set(NacosSupport.parse(initial));
      NacosSupport.publish(service, NacosSupport.SCENARIO, NacosSupport.content(999, "demo-invalid"));
      if (!rejected.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("未观察到非法配置");
      System.out.println("active topK=" + active.get().topK());
      NacosSupport.publish(service, NacosSupport.SCENARIO, NacosSupport.content(6, "demo-v2"));
      if (!applied.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("新配置未生效");
      var snapshot = active.get();
      var candidates = IntStream.rangeClosed(1, 10).mapToObj(i -> "demo-doc-" + i).toList();
      System.out.println("toy retrieval=" + candidates.subList(0, snapshot.topK()));
    } finally {
      service.removeListener(NacosSupport.SCENARIO, NacosSupport.GROUP, listener);
      service.shutDown();
    }
  }
}
