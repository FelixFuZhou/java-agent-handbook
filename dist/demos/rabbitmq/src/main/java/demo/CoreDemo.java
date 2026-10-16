package demo;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    try (var connection = RabbitSupport.connect(); var channel = connection.createChannel()) {
      var topology = RabbitSupport.declare(channel, "core");
      RabbitSupport.publish(channel, topology, "demo-ok-" + UUID.randomUUID(), "document-ok");
      RabbitSupport.publish(channel, topology, "demo-bad-" + UUID.randomUUID(), "BAD");
      for (int i = 0; i < 2; i++) {
        var message = RabbitSupport.get(channel, topology.queue());
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        long tag = message.getEnvelope().getDeliveryTag();
        if (body.equals("BAD")) {
          channel.basicNack(tag, false, false);
          System.out.println("NACK to DLQ");
        } else {
          channel.basicAck(tag, false);
          System.out.println("ACK " + body);
        }
      }
      RabbitSupport.showDead(channel, topology);
    }
  }
}
