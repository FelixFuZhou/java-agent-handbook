package demo;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    try (var connection = RabbitSupport.connect();
         var publisher = connection.createChannel();
         var worker = connection.createChannel()) {
      var topology = RabbitSupport.declare(publisher, "scenario");
      RabbitSupport.publish(publisher, topology, "demo-task-" + UUID.randomUUID(), "doc-201|2");
      RabbitSupport.publish(publisher, topology, "demo-task-" + UUID.randomUUID(), "BAD");
      var completed = new CountDownLatch(2);
      worker.basicQos(1);
      String consumerTag = worker.basicConsume(topology.queue(), false, (tag, delivery) -> {
        String body = new String(delivery.getBody(), StandardCharsets.UTF_8);
        long deliveryTag = delivery.getEnvelope().getDeliveryTag();
        if (body.equals("BAD")) {
          worker.basicNack(deliveryTag, false, false);
          System.out.println("NACK: 损坏文档交给失败处理");
        } else {
          // 这里替换成提交完成的幂等索引服务；println 不代表生产持久写入。
          System.out.println("INDEX toy " + body);
          worker.basicAck(deliveryTag, false);
          System.out.println("ACK: toy 处理结束");
        }
        completed.countDown();
      }, tag -> System.err.println("Consumer cancelled: " + tag));
      if (!completed.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("消费未完成");
      worker.basicCancel(consumerTag);
      RabbitSupport.showDead(publisher, topology);
    }
  }
}
