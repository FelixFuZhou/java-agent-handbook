package demo;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.apache.rocketmq.client.consumer.DefaultMQPushConsumer;
import org.apache.rocketmq.client.consumer.listener.*;
import org.apache.rocketmq.client.producer.*;
import org.apache.rocketmq.common.consumer.ConsumeFromWhere;
import org.apache.rocketmq.common.message.Message;

public final class RocketSupport {
  private RocketSupport() {}
  static String topic() {
    String value = Env.get("DEMO_ROCKETMQ_TOPIC", "demo-agent-rocketmq");
    if (!value.startsWith("demo-")) throw new IllegalArgumentException("要求 demo- 前缀");
    return value;
  }
  static DefaultMQProducer producer(String suffix) throws Exception {
    var p = new DefaultMQProducer("demo-agent-rmq-producer-" + suffix);
    p.setNamesrvAddr(Env.get("ROCKETMQ_NAMESRV", "localhost:9876"));
    p.setSendMsgTimeout(10000);
    p.start();
    return p;
  }
  static void send(DefaultMQProducer p, String tag, String key) throws Exception {
    var message = new Message(topic(), tag, "doc-101|2".getBytes(StandardCharsets.UTF_8));
    message.setKeys(key);
    var result = p.send(message);
    System.out.println("SEND " + result.getSendStatus() + " key=" + key);
    if (result.getSendStatus() != SendStatus.SEND_OK)
      throw new IllegalStateException("生产确认异常，需对账，不可假定未发送");
  }
  static void roundTrip(boolean retry) throws Exception {
    String tag = retry ? "scenario" : "core";
    String key = "demo-doc-" + UUID.randomUUID();
    int count = retry ? 2 : 1;
    var completed = new CountDownLatch(count);
    // 仅用于教学：这里不是持久去重，也不与业务事务绑定。
    Set<String> seen = ConcurrentHashMap.newKeySet();
    var consumer = new DefaultMQPushConsumer("demo-agent-rmq-consumer-" + tag);
    consumer.setNamesrvAddr(Env.get("ROCKETMQ_NAMESRV", "localhost:9876"));
    consumer.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_FIRST_OFFSET);
    consumer.setConsumeThreadMin(1);
    consumer.setConsumeThreadMax(1);
    consumer.setConsumeMessageBatchMaxSize(1);
    consumer.setMaxReconsumeTimes(3);
    consumer.subscribe(topic(), tag);
    consumer.registerMessageListener((MessageListenerConcurrently) (messages, context) -> {
      for (var message : messages) {
        if (!key.equals(message.getKeys())) continue;
        System.out.println("RECEIVE attempt=" + message.getReconsumeTimes());
        if (retry && message.getReconsumeTimes() == 0) {
          System.out.println("RETRY：模拟解析服务暂时不可用");
          return ConsumeConcurrentlyStatus.RECONSUME_LATER;
        }
        if (seen.add(message.getKeys())) {
          String body = new String(message.getBody(), StandardCharsets.UTF_8);
          System.out.println("INDEX (toy)=" + body);
        } else {
          System.out.println("SKIP duplicate (仅当前进程)=" + message.getKeys());
        }
        completed.countDown();
      }
      return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
    });
    DefaultMQProducer producer = null;
    try {
      consumer.start();
      producer = producer(tag);
      for (int i = 0; i < count; i++) send(producer, tag, key);
      if (!completed.await(90, TimeUnit.SECONDS))
        throw new IllegalStateException("消费未完成，请查重试、订阅与 Broker 日志");
      Thread.sleep(1000); // 给回调返回及客户端收尾留出时间。
      System.out.println("DONE " + key);
    } finally {
      if (producer != null) producer.shutdown();
      consumer.shutdown();
    }
  }
}
