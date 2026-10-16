package demo;
import com.alibaba.nacos.api.config.listener.Listener;
import java.util.UUID;
import java.util.concurrent.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var service = NacosSupport.connect();
    var changed = new CountDownLatch(1);
    String revision = "demo-" + UUID.randomUUID();
    Listener listener = new Listener() {
      public Executor getExecutor() { return null; }
      public void receiveConfigInfo(String content) {
        System.out.println("CHANGED " + content);
        if (content != null && content.contains(revision)) changed.countDown();
      }
    };
    try {
      NacosSupport.publish(service, NacosSupport.CORE, NacosSupport.content(3, "demo-initial"));
      String initial = service.getConfigAndSignListener(
        NacosSupport.CORE, NacosSupport.GROUP, 5000, listener);
      System.out.println("initial=" + initial);
      NacosSupport.publish(service, NacosSupport.CORE, NacosSupport.content(5, revision));
      if (!changed.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("没有收到配置变更");
    } finally {
      service.removeListener(NacosSupport.CORE, NacosSupport.GROUP, listener);
      service.shutDown();
    }
  }
}
