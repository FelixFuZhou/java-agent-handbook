package demo;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.admin.AdminClient;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    try (var admin = AdminClient.create(KafkaSupport.common())) {
      var result = admin.describeCluster();
      System.out.println("clusterId=" + result.clusterId().get(15, TimeUnit.SECONDS));
      System.out.println("brokers=" + result.nodes().get(15, TimeUnit.SECONDS));
    }
  }
}
