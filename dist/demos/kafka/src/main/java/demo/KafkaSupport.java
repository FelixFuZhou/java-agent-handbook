package demo;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutionException;
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.errors.TopicExistsException;

public final class KafkaSupport {
  private KafkaSupport() {}
  static Properties common() {
    Properties p = new Properties();
    p.put("bootstrap.servers", Env.get("KAFKA_BOOTSTRAP", "localhost:9092"));
    p.put("request.timeout.ms", "10000");
    p.put("default.api.timeout.ms", "15000");
    return p;
  }
  static String topic(String suffix) {
    String prefix = Env.get("DEMO_KAFKA_PREFIX", "demo-agent-kafka");
    if (!prefix.startsWith("demo-")) throw new IllegalArgumentException("要求 demo- 前缀");
    return prefix + "-" + suffix;
  }
  static void ensureTopic(String topic) throws Exception {
    try (AdminClient admin = AdminClient.create(common())) {
      try {
        admin.createTopics(List.of(new NewTopic(topic, 3, (short) 1)))
          .all().get(15, TimeUnit.SECONDS);
      } catch (ExecutionException e) {
        if (!(e.getCause() instanceof TopicExistsException)) throw e;
      }
    }
  }
  static KafkaProducer<String,String> producer() {
    Properties p = common();
    p.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
    p.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
    p.put("acks", "all");
    p.put("enable.idempotence", "true");
    p.put("delivery.timeout.ms", "15000");
    p.put("max.block.ms", "15000");
    return new KafkaProducer<>(p);
  }
  static KafkaConsumer<String,String> consumer() {
    Properties p = common();
    p.put("group.id", Env.get("DEMO_KAFKA_GROUP", "demo-agent-kafka-indexer"));
    p.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
    p.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
    p.put("enable.auto.commit", "false");
    p.put("auto.offset.reset", "earliest");
    p.put("max.poll.records", "1");
    return new KafkaConsumer<>(p);
  }
  static RecordMetadata publish(String topic, String key, String body) throws Exception {
    try (var producer = producer()) {
      return producer.send(new ProducerRecord<>(topic, key, body)).get(20, TimeUnit.SECONDS);
    }
  }
}
