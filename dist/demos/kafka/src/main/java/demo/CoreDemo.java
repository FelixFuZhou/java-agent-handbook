package demo;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    String topic = KafkaSupport.topic("core");
    KafkaSupport.ensureTopic(topic);
    var first = KafkaSupport.publish(topic, "doc-101", "doc-101|1");
    var second = KafkaSupport.publish(topic, "doc-101", "doc-101|2");
    System.out.printf("v1 partition=%d offset=%d%n", first.partition(), first.offset());
    System.out.printf("v2 partition=%d offset=%d%n", second.partition(), second.offset());
    if (first.partition() != second.partition()) throw new IllegalStateException("检查分区数变更");
  }
}
