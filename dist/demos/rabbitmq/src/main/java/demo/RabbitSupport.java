package demo;
import com.rabbitmq.client.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public final class RabbitSupport {
  private RabbitSupport() {}
  record Topology(String exchange, String queue, String dead) {}
  static Connection connect() throws Exception {
    var factory = new ConnectionFactory();
    factory.setUri(Env.get("RABBITMQ_URI", "amqp://guest:guest@localhost:5672/%2f"));
    factory.setConnectionTimeout(10000);
    factory.setAutomaticRecoveryEnabled(false); // 教学中显式暴露连接失败。
    return factory.newConnection("demo-agent-rabbit");
  }
  static Topology declare(Channel channel, String stage) throws Exception {
    String prefix = Env.get("DEMO_RABBIT_PREFIX", "demo.agent.rabbit");
    if (!prefix.startsWith("demo.")) throw new IllegalArgumentException("要求 demo. 前缀");
    String exchange = prefix + "." + stage;
    String queue = exchange + ".work";
    String deadExchange = exchange + ".dlx";
    String dead = exchange + ".dead";
    channel.exchangeDeclare(exchange, BuiltinExchangeType.DIRECT, true);
    channel.exchangeDeclare(deadExchange, BuiltinExchangeType.DIRECT, true);
    channel.queueDeclare(dead, true, false, false, null);
    channel.queueBind(dead, deadExchange, "failed");
    channel.queueDeclare(queue, true, false, false, Map.of(
      "x-dead-letter-exchange", deadExchange,
      "x-dead-letter-routing-key", "failed"));
    channel.queueBind(queue, exchange, "parse");
    return new Topology(exchange, queue, dead);
  }
  static void publish(Channel channel, Topology topology, String id, String body) throws Exception {
    var returned = new AtomicBoolean(false);
    ReturnListener listener = (code, text, ex, key, props, bytes) -> returned.set(true);
    channel.addReturnListener(listener);
    try {
      channel.confirmSelect();
      var props = new AMQP.BasicProperties.Builder().deliveryMode(2)
        .contentType("text/plain").messageId(id).build();
      channel.basicPublish(topology.exchange(), "parse", true, props,
        body.getBytes(StandardCharsets.UTF_8));
      channel.waitForConfirmsOrDie(10000);
      if (returned.get()) throw new IllegalStateException("消息没有路由到队列");
      System.out.println("CONFIRMED " + id);
    } finally { channel.removeReturnListener(listener); }
  }
  static GetResponse get(Channel channel, String queue) throws Exception {
    for (int i = 0; i < 50; i++) {
      GetResponse result = channel.basicGet(queue, false);
      if (result != null) return result;
      Thread.sleep(100);
    }
    throw new IllegalStateException("等待队列消息超时: " + queue);
  }
  static void showDead(Channel channel, Topology topology) throws Exception {
    var message = get(channel, topology.dead());
    System.out.println("DEAD " + new String(message.getBody(), StandardCharsets.UTF_8));
    System.out.println("headers=" + message.getProps().getHeaders());
    channel.basicAck(message.getEnvelope().getDeliveryTag(), false);
  }
}
