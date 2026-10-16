package demo;
import java.time.Duration;
import java.util.*;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String topic = KafkaSupport.topic("scenario");
    KafkaSupport.ensureTopic(topic);
    KafkaSupport.publish(topic, "doc-101", "doc-101|2");
    Map<String,Integer> toyIndex = new HashMap<>(); // 重启会丢失，不是生产去重表。
    boolean failOnce = Boolean.parseBoolean(Env.get("DEMO_FAIL_ONCE", "true"));
    try (var consumer = KafkaSupport.consumer()) {
      consumer.subscribe(List.of(topic));
      long deadline = System.nanoTime() + Duration.ofSeconds(45).toNanos();
      while (System.nanoTime() < deadline) {
        for (var record : consumer.poll(Duration.ofSeconds(1))) {
          var partition = new TopicPartition(record.topic(), record.partition());
          try {
            if (failOnce) {
              failOnce = false;
              throw new IllegalStateException("模拟索引服务暂时不可用");
            }
            String[] fields = record.value().split("\\|");
            int version = Integer.parseInt(fields[1]);
            toyIndex.merge(fields[0], version, Math::max);
            System.out.println("INDEX (in-memory demo)=" + toyIndex);
          } catch (RuntimeException failure) {
            System.out.println("RETRY without commit offset=" + record.offset());
            consumer.seek(partition, record.offset());
            Thread.sleep(500);
            continue;
          }
          long next = record.offset() + 1;
          consumer.commitSync(Map.of(partition, new OffsetAndMetadata(next)));
          System.out.println("COMMIT nextOffset=" + next);
          return;
        }
      }
      throw new IllegalStateException("45 秒内没有完成消费，请查消费组和 Topic");
    }
  }
}
