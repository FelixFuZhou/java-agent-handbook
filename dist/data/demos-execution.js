import { file, java, pom, dep, envFile, run } from './demo-kit.js';

// 独立下载项目；所有业务结果均为明确标注的教学数据，中间件调用使用真实 SDK。
const path = name => `src/main/java/demo/${name}.java`;
const stage = (id, title, description, focus, commands, expected, troubleshooting, names) => ({
  id, title, description, focus, commands, expected, troubleshooting,
  files: ['pom.xml', path('Env'), ...names.map(path)]
});
const base = 'JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。';

const kafka = {
  id:'kafka', title:'Kafka：分区键、手动提交与索引事件',
  summary:'完整 Java 客户端项目：检查集群，观察相同 key 的分区，再演示处理失败不提交 offset。',
  scenario:'知识文档发布事件驱动索引 Worker。Kafka 真正传输消息，索引器使用进程内 Map 演示版本写入，不代表持久幂等。',
  prerequisites:[base,'依赖 kafka-clients 3.9.0；准备可连接的 Kafka Broker，本例使用无认证的本地 PLAINTEXT 环境。','账号需要读取集群元数据、创建 demo 前缀 Topic、发送与消费权限；示例创建 3 分区、1 副本的教学 Topic，不用于生产。Broker advertised.listeners 必须能从 Java 进程访问。'],
  environment:[{name:'KAFKA_BOOTSTRAP',example:'localhost:9092',description:'Broker 地址，容器中运行 Java 时改为可访问的服务地址。'},{name:'DEMO_KAFKA_PREFIX',example:'demo-agent-kafka',description:'只使用 demo 前缀；代码为 core/scenario 创建独立 Topic。'},{name:'DEMO_KAFKA_GROUP',example:'demo-agent-kafka-indexer',description:'场景消费组；重启复用此值即可读取已提交位置。'},{name:'DEMO_FAIL_ONCE',example:'true',description:'每个演示进程第一次处理时模拟失败，再 seek 重读；false 关闭。'}],
  stages:[
    stage('connect','基础接入 · 检查集群元数据','读取真实集群 ID 与节点，不发送业务消息。',['Bootstrap 只用于发现集群','有限请求超时'],[run('ConnectDemo')],['打印 clusterId 和 brokers。'],['连接 bootstrap 成功但后续超时，检查 advertised.listeners 返回的地址；本例未配置 SASL/TLS。'],['ConnectDemo','KafkaSupport']),
    stage('core','核心功能 · 用 key 维持分区内顺序','同一文档 key 发送两个版本，等待生产确认并打印分区和 offset。',['acks=all 与幂等生产','相同 key 在分区数不变时进入同一分区'],[run('CoreDemo')],['两条 doc-101 消息 partition 一致，offset 递增；创建已存在的 Topic 会复用。'],['没有 Topic 创建权限时由管理员按相同名称预建；1 副本只用于本地学习，不能据此推断生产可用性。'],['CoreDemo','KafkaSupport']),
    stage('scenario','场景应用 · 失败不提交，成功再推进','发送文档事件并使用固定消费组；首次失败后不提交，seek 到原 offset，完成 toy 索引后显式提交 offset+1。',['关闭自动提交','失败必须同时控制当前 position','Map 只演示版本判断，重启后不保留'],[run('ScenarioDemo')],['依次出现 RETRY without commit、INDEX、COMMIT nextOffset；第二次进程启动从消费组已提交位置继续。'],['没有有效提交位置时 earliest 才生效；重跑会再发布一条事件。','业务写入成功、offset 提交前崩溃仍会重复；生产用持久操作流水或幂等 upsert。'],['ScenarioDemo','KafkaSupport'])
  ],
  files:[pom('kafka',dep('org.apache.kafka','kafka-clients','3.9.0')),envFile,
    java('KafkaSupport',String.raw`package demo;
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
}`),
    java('ConnectDemo',String.raw`package demo;
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
}`),
    java('CoreDemo',String.raw`package demo;
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
}`),
    java('ScenarioDemo',String.raw`package demo;
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
}`)],
  sources:[{label:'Kafka 3.9 Consumer：手动 offset 与至少一次',url:'https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html'},{label:'Kafka Producer API',url:'https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html'}]
};

const rocketmq = {
  id:'rocketmq',title:'RocketMQ：发送确认、消费重试与业务 Key',
  summary:'使用锁定版本的传统 Remoting Java SDK，连接真实 NameServer/Broker，完整演示生产与消费失败重试。',
  scenario:'文档发布后触发 Agent 索引任务。消息系统实际执行发送与重投；进程内集合只示范同一运行期的去重，不承诺持久幂等。',
  prerequisites:[base,'依赖 rocketmq-client 4.9.8，使用兼容的 4.x/5.x Broker Remoting 接口；这里不是 5.x gRPC Proxy 客户端。','管理员提前创建 demo-agent-rocketmq Topic（例如 mqadmin updateTopic -n localhost:9876 -c DefaultCluster -t demo-agent-rocketmq，集群名按实际修改）。需允许 demo 生产组/消费组访问；示例是无 ACL 的隔离学习环境。','NameServer 与 Broker 对外注册地址都必须可达；重试演示最长等待 90 秒，Broker 需允许消费重试。'],
  environment:[{name:'ROCKETMQ_NAMESRV',example:'localhost:9876',description:'NameServer Remoting 地址，不是 gRPC Proxy 地址。'},{name:'DEMO_ROCKETMQ_TOPIC',example:'demo-agent-rocketmq',description:'已创建的 demo 前缀 Topic。'}],
  stages:[
    stage('connect','基础接入 · 查询 Topic 路由','启动生产客户端，获取 Topic 可发布队列并关闭资源。',['NameServer 与 Broker 路由','Topic 需要预先存在'],[run('ConnectDemo')],['输出真实 MessageQueue 列表。'],['No route info：检查 Topic、集群与 NameServer；连接 Broker 超时检查 Broker 对外地址，不能只检查 9876 端口。'],['ConnectDemo','RocketSupport']),
    stage('core','核心功能 · 发送并消费确认','在一个进程里启动消费者，再发送唯一 Key 消息，等待消费回调。',['SEND_OK 才视为生产确认','消费成功返回 CONSUME_SUCCESS'],[run('CoreDemo')],['看到 SEND_OK 与 DONE；正常返回前消费者已处理该运行的事件。'],['此处每次生成运行 Key；消费者订阅固定 core Tag，历史事件会被读取但忽略。无消费检查组名、订阅和权限。'],['CoreDemo','RocketSupport']),
    stage('scenario','场景应用 · 首次失败重试与重复事件','发送两条相同业务 Key 的消息；首次收到分别返回 RECONSUME_LATER，再次收到后处理或跳过进程内重复。',['重试次数来自 getReconsumeTimes','setKeys 是追踪标识，不是 Broker 去重','真实业务必须持久化幂等结果'],[run('ScenarioDemo')],['打印 RETRY、随后 INDEX、SKIP duplicate；重试通常有等待时间。'],['90 秒内不完成：查 Broker 重试策略和失败队列；不要改成无限快速重发。','进程重启后集合会清空；生产用稳定事件 ID、数据库唯一约束及事务提交。'],['ScenarioDemo','RocketSupport'])
  ],
  files:[pom('rocketmq',dep('org.apache.rocketmq','rocketmq-client','4.9.8')),envFile,
    java('RocketSupport',String.raw`package demo;
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
}`),
    java('ConnectDemo',String.raw`package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var producer = RocketSupport.producer("connect");
    try {
      System.out.println("queues=" + producer.fetchPublishMessageQueues(RocketSupport.topic()));
    } finally { producer.shutdown(); }
  }
}`),
    java('CoreDemo',String.raw`package demo;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    RocketSupport.roundTrip(false);
  }
}`),
    java('ScenarioDemo',String.raw`package demo;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    RocketSupport.roundTrip(true);
  }
}`)],
  sources:[{label:'RocketMQ 4.x：普通消息发送',url:'https://rocketmq.apache.org/docs/4.x/producer/02message1/'},{label:'RocketMQ 4.x：Push Consumer 与重试状态',url:'https://rocketmq.apache.org/docs/4.x/consumer/02push/'}]
};

const rabbitmq = {
  id:'rabbitmq',title:'RabbitMQ：发布确认、手动确认与死信',
  summary:'连接真实 AMQP Broker，声明独立教学拓扑，观察 publisher confirm、consumer ack 和 nack 的不同职责。',
  scenario:'Agent 把文档解析任务交给 Worker；正常任务确认，损坏输入拒绝并路由到死信队列。业务解析是固定教学逻辑。',
  prerequisites:[base,'依赖 com.rabbitmq:amqp-client 5.23.0；准备已有 RabbitMQ AMQP 0-9-1 服务。','使用专用学习 vhost 和具有 configure/write/read 权限的账号。默认 guest URI 仅供本机；远程连接应使用专用账号并按部署启用 TLS。','示例创建 demo.agent.rabbit 前缀 durable 队列和交换机，不清空现有队列；重复运行的历史任务也可能被读取。'],
  environment:[{name:'RABBITMQ_URI',example:'amqp://guest:guest@localhost:5672/%2f',description:'AMQP URI；不要把真实凭据写入源码或提交 Git。'},{name:'DEMO_RABBIT_PREFIX',example:'demo.agent.rabbit',description:'教学交换机、工作队列和死信对象的独立前缀。'}],
  stages:[
    stage('connect','基础接入 · 建立 AMQP 连接','建立 Connection 和 Channel，再主动关闭。',['连接与 Channel 生命周期','应用账号与 vhost 权限'],[run('ConnectDemo')],['打印 connected=true 和 channel 编号。'],['ACCESS_REFUSED：核对账号、vhost 和权限；5672 是 AMQP，不是管理页面端口。'],['ConnectDemo','RabbitSupport']),
    stage('core','核心功能 · Confirm、Ack 与 Nack','发布正常和坏消息，等待生产确认；手动拉取后分别 ack 与 nack(false)，验证坏消息进入已绑定的 DLQ。',['发布确认不等于业务完成','nack requeue=false 依赖已配置 DLX','读取 DLQ 后同样需要确认'],[run('CoreDemo')],['出现 CONFIRMED、ACK、NACK to DLQ 和 DEAD；坏消息的死信头包含 x-death。'],['PRECONDITION_FAILED 表示同名队列参数与现有定义不一致，换新的 demo 前缀或由管理员核对；不要删除生产队列。'],['CoreDemo','RabbitSupport']),
    stage('scenario','场景应用 · 解析 Worker 与背压','真实队列传输两项任务；消费者 prefetch=1，完成后确认，坏文档进入死信。',['手动 ack 在 toy 工作结束后','prefetch 控制未确认消息','失败不立即反复 requeue'],[run('ScenarioDemo')],['打印 INDEX toy、ACK 或 NACK；DLQ 里可以看到坏文档。'],['unacked 很多时查阻塞与漏 ack；ready 增长查消费者与处理速度。','示例无持久幂等，连接在业务完成后、ack 前断开仍会重投，生产需用 taskId 持久去重。'],['ScenarioDemo','RabbitSupport'])
  ],
  files:[pom('rabbitmq',dep('com.rabbitmq','amqp-client','5.23.0')),envFile,
    java('RabbitSupport',String.raw`package demo;
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
}`),
    java('ConnectDemo',String.raw`package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    try (var connection = RabbitSupport.connect(); var channel = connection.createChannel()) {
      System.out.println("connected=" + connection.isOpen() + " channel=" + channel.getChannelNumber());
    }
  }
}`),
    java('CoreDemo',String.raw`package demo;
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
}`),
    java('ScenarioDemo',String.raw`package demo;
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
}`)],
  sources:[{label:'RabbitMQ：Java 客户端 API',url:'https://www.rabbitmq.com/client-libraries/java-api-guide'},{label:'RabbitMQ：生产确认与消费者确认',url:'https://www.rabbitmq.com/docs/confirms'},{label:'RabbitMQ：死信交换机',url:'https://www.rabbitmq.com/docs/dlx'}]
};

const temporal = {
  id:'temporal',title:'Temporal：Workflow、Activity 与恢复',
  summary:'完整的 Java Worker 与客户端，使用真实 Temporal 服务调度工作流，设置 Activity 超时和有限重试。',
  scenario:'研究 Agent 先检索资料，再生成报告。检索与生成用明确的固定业务字符串模拟；工作流历史、任务调度和重试由真实 Temporal 服务完成。',
  prerequisites:[base,'依赖 temporal-sdk 1.27.0；已有可访问的 Temporal Server，命名空间默认 default。这里不部署服务端。','服务端命名空间必须存在，连接使用本地无 TLS 环境；生产按服务端要求增加 TLS 与认证。','必须保持 Worker 终端运行，再从另一个终端启动客户端；服务器持久化执行历史，Worker 提供 Java 代码，两者缺一不可。'],
  environment:[{name:'TEMPORAL_TARGET',example:'localhost:7233',description:'Temporal gRPC 服务地址。'},{name:'TEMPORAL_NAMESPACE',example:'default',description:'服务端已存在的 Namespace。'},{name:'DEMO_TEMPORAL_QUEUE',example:'demo-agent-research',description:'Worker 与客户端必须使用相同 Task Queue。'},{name:'DEMO_WORKFLOW_ID',example:'demo-agent-research-001',description:'场景固定 Workflow ID；重跑复用已有执行，换 ID 才启动新任务。'},{name:'DEMO_ACTIVITY_FAIL_ONCE',example:'true',description:'检索 Activity 首次 attempt 失败；后续 attempt 返回固定教学证据。'}],
  stages:[
    stage('connect','基础接入 · 检查 Temporal 服务','通过 gRPC 获取服务端能力；只证明服务连通，命名空间在启动任务时继续校验。',['gRPC 目标地址','SDK 客户端主动释放连接'],[run('ConnectDemo')],['打印 systemInfo；无法连接时抛出服务错误。'],['检查 7233 端口而不是 Web UI 端口；此例未配置云服务认证。'],['ConnectDemo','TemporalSupport']),
    stage('core','核心功能 · 启动 Worker 并运行工作流','终端 A 运行 worker 保持进程；终端 B 运行 start，观察检索 Activity 第一次失败后由服务端安排重试。',['Workflow 代码不执行普通网络 I/O','Activity 设置 StartToClose 和 RetryOptions','Workflow.sleep 由服务端定时器管理'],[`${run('CoreDemo')} -Dexec.args=worker`,`${run('CoreDemo')} -Dexec.args=start`],['Worker 输出 READY；第二终端打印最终 report，Worker 可看到 attempt=1 和 attempt=2。'],['任务一直等待通常是 Task Queue 不匹配或 Worker 未运行；确认两个终端使用同一环境变量。'],['CoreDemo','TemporalSupport','DemoWorkflow','DemoActivities','DemoWorkflowImpl','ToyActivities']),
    stage('scenario','场景应用 · 稳定任务 ID 与恢复','保持核心阶段 Worker 运行，客户端用固定 ID 启动或获取已有执行，并等待结果。可在 Activity 等待期间重启 Worker，随后查看同一执行。',['拒绝重复 Workflow ID','执行历史恢复不等于外部业务恰好一次','真实工具写操作必须带幂等键'],[run('ScenarioDemo')],['首次打印 START；再次运行打印 EXISTING，然后获得同一执行的结果。'],['客户端等待最多 90 秒；超时不会自动取消服务端工作流，使用同一 ID 查询。','示例任务执行上限 2 分钟；不要在 Workflow 内调用 Thread.sleep、读取环境或直接发 HTTP。'],['ScenarioDemo','TemporalSupport','DemoWorkflowImpl','ToyActivities'])
  ],
  files:[pom('temporal',dep('io.temporal','temporal-sdk','1.27.0')),envFile,
    java('TemporalSupport',String.raw`package demo;
import io.temporal.client.*;
import io.temporal.serviceclient.*;
import io.temporal.api.enums.v1.WorkflowIdReusePolicy;
import java.time.Duration;
public final class TemporalSupport implements AutoCloseable {
  final WorkflowServiceStubs service;
  final WorkflowClient client;
  TemporalSupport() {
    service = WorkflowServiceStubs.newServiceStubs(WorkflowServiceStubsOptions.newBuilder()
      .setTarget(Env.get("TEMPORAL_TARGET", "localhost:7233")).build());
    client = WorkflowClient.newInstance(service, WorkflowClientOptions.newBuilder()
      .setNamespace(Env.get("TEMPORAL_NAMESPACE", "default")).build());
  }
  static String queue() { return Env.get("DEMO_TEMPORAL_QUEUE", "demo-agent-research"); }
  DemoWorkflow newRun(String id) {
    if (!id.startsWith("demo-")) throw new IllegalArgumentException("要求 demo- 工作流 ID");
    return client.newWorkflowStub(DemoWorkflow.class, WorkflowOptions.newBuilder()
      .setTaskQueue(queue()).setWorkflowId(id)
      .setWorkflowExecutionTimeout(Duration.ofMinutes(2))
      .setWorkflowIdReusePolicy(WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE)
      .build());
  }
  public void close() { service.shutdown(); }
}`),
    java('DemoWorkflow',String.raw`package demo;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;
@WorkflowInterface
public interface DemoWorkflow {
  @WorkflowMethod String run(String taskId);
}`),
    java('DemoActivities',String.raw`package demo;
import io.temporal.activity.ActivityInterface;
@ActivityInterface
public interface DemoActivities {
  String execute(String taskId, String step);
}`),
    java('DemoWorkflowImpl',String.raw`package demo;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import io.temporal.workflow.Workflow;
import java.time.Duration;
public class DemoWorkflowImpl implements DemoWorkflow {
  private final DemoActivities activities = Workflow.newActivityStub(DemoActivities.class,
    ActivityOptions.newBuilder()
      .setStartToCloseTimeout(Duration.ofSeconds(10))
      .setScheduleToCloseTimeout(Duration.ofSeconds(40))
      .setRetryOptions(RetryOptions.newBuilder().setMaximumAttempts(3)
        .setInitialInterval(Duration.ofSeconds(1)).build()).build());
  public String run(String taskId) {
    String evidence = activities.execute(taskId, "retrieve");
    Workflow.sleep(Duration.ofSeconds(1));
    String report = activities.execute(taskId, "report");
    return report + " | " + evidence;
  }
}`),
    java('ToyActivities',String.raw`package demo;
import io.temporal.activity.Activity;
public class ToyActivities implements DemoActivities {
  public String execute(String taskId, String step) {
    int attempt = Activity.getExecutionContext().getInfo().getAttempt();
    System.out.printf("task=%s step=%s attempt=%d%n", taskId, step, attempt);
    if (step.equals("retrieve") && attempt == 1 &&
        Boolean.parseBoolean(Env.get("DEMO_ACTIVITY_FAIL_ONCE", "true")))
      throw new IllegalStateException("演示：检索服务暂时不可用");
    // 模拟可中断的外部耗时，真实网络调用应有自己的请求超时。
    try { Thread.sleep(2000); }
    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw Activity.wrap(e); }
    // 这里没有真实模型，也没有外部写入；生产工具需持久幂等。
    return step.equals("retrieve") ? "evidence:doc-101:v2" : "report:" + taskId;
  }
}`),
    java('ConnectDemo',String.raw`package demo;
import io.temporal.api.workflowservice.v1.GetSystemInfoRequest;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var support = new TemporalSupport()) {
      System.out.println(support.service.blockingStub()
        .getSystemInfo(GetSystemInfoRequest.newBuilder().build()));
    }
  }
}`),
    java('CoreDemo',String.raw`package demo;
import io.temporal.worker.WorkerFactory;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    if (args.length != 1) throw new IllegalArgumentException("参数：worker 或 start");
    try (var support = new TemporalSupport()) {
      if (args[0].equals("worker")) {
        var factory = WorkerFactory.newInstance(support.client);
        var worker = factory.newWorker(TemporalSupport.queue());
        worker.registerWorkflowImplementationTypes(DemoWorkflowImpl.class);
        worker.registerActivitiesImplementations(new ToyActivities());
        Runtime.getRuntime().addShutdownHook(new Thread(factory::shutdown));
        factory.start();
        System.out.println("READY queue=" + TemporalSupport.queue());
        try { new CountDownLatch(1).await(); }
        finally { factory.shutdown(); }
      } else if (args[0].equals("start")) {
        String id = "demo-core-" + UUID.randomUUID();
        System.out.println(support.newRun(id).run(id));
      } else throw new IllegalArgumentException("参数：worker 或 start");
    }
  }
}`),
    java('ScenarioDemo',String.raw`package demo;
import io.temporal.client.*;
import java.util.concurrent.TimeUnit;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String id = Env.get("DEMO_WORKFLOW_ID", "demo-agent-research-001");
    try (var support = new TemporalSupport()) {
      var workflow = support.newRun(id);
      try {
        var execution = WorkflowClient.start(workflow::run, id);
        System.out.println("START " + execution.getWorkflowId());
      } catch (WorkflowExecutionAlreadyStarted existing) {
        System.out.println("EXISTING " + id);
        workflow = support.client.newWorkflowStub(DemoWorkflow.class, id);
      }
      String result = WorkflowStub.fromTyped(workflow).getResult(90, TimeUnit.SECONDS, String.class);
      System.out.println(result);
    }
  }
}`)],
  sources:[{label:'Temporal Java：客户端启动工作流',url:'https://docs.temporal.io/develop/java/temporal-client'},{label:'Temporal Java：Activity 超时与重试',url:'https://docs.temporal.io/develop/java/failure-detection'},{label:'Temporal Java SDK',url:'https://github.com/temporalio/sdk-java'}]
};

const nacos = {
  id:'nacos',title:'Nacos：配置读取、监听与安全生效',
  summary:'用真实 Java ConfigService 读取和发布教学配置；监听到变更以后先校验，再原子替换应用内策略。',
  scenario:'知识助手动态调整检索 topK。配置存于真实 Nacos，候选文档用固定列表演示；非法配置被拒绝，应用保留上一个有效策略。',
  prerequisites:[base,'依赖 nacos-client 2.4.3；准备兼容的 Nacos 服务端与专用学习 Namespace。需读取、发布和监听 demo 配置的权限。','本地默认 HTTP 端口 8848；Nacos 2.x 客户端还需要 gRPC 端口可达，默认相对主端口偏移 +1000，即 9848。按实际部署核对。','示例会创建或更新 DEMO_AGENT 组内 demo-agent-retrieval-core.properties 与 scenario.properties；不要用生产配置标识。'],
  environment:[{name:'NACOS_SERVER',example:'localhost:8848',description:'Nacos serverAddr。'},{name:'NACOS_NAMESPACE_ID',example:'',description:'实际 Namespace ID；留空表示默认空间，不是显示名称。'},{name:'NACOS_USER',example:'<学习账号>',description:'启用认证时配置账号；未启用时可不设置。'},{name:'NACOS_PASSWORD',example:'<账号密码>',description:'与账号一起由环境注入，代码不打印。'}],
  stages:[
    stage('connect','基础接入 · 读取配置快照','连接 ConfigService，读取固定教学 Data ID；首次不存在时明确显示不存在。',['服务地址、Namespace、Group、Data ID 四项定位','读取到 null 与请求失败不同'],[run('ConnectDemo')],['打印 serverStatus；首次打印 config absent，核心阶段执行后可看到配置正文。'],['权限错误查账号；读取为空查 Namespace ID、Group 与 Data ID；HTTP 通但监听失败查 gRPC 端口。'],['ConnectDemo','NacosSupport']),
    stage('core','核心功能 · 发布并监听变更','先发布基线，再使用 getConfigAndSignListener 获取快照和注册 Listener，更新内容并等待通知。',['getConfig 只是读取','Listener 才处理后续变化','退出前移除监听并 shutdown'],[run('CoreDemo')],['打印 initial、CHANGED；未收到变更会在 15 秒后报错。'],['重复发布相同正文可能没有新通知；本例用唯一 revision 区分。多实例生效并非同时完成。'],['CoreDemo','NacosSupport']),
    stage('scenario','场景应用 · 非法 topK 保留旧值','动态发布 topK=999，Listener 拒绝；再发布 topK=6，校验后更新 AtomicReference，toy 检索使用新的快照。',['校验范围后原子切换不可变策略','读取一次策略快照用于一次请求','配置版本可以进入调用日志'],[run('ScenarioDemo')],['打印 REJECTED、active topK=3、APPLIED demo-v2；最终取出 6 个教学文档。'],['收到配置不等于对象更新：检查 Listener、解析与实际读取的 AtomicReference。','该示例发布配置用于学习，真实发布权限与运行时只读身份应分开。'],['ScenarioDemo','NacosSupport'])
  ],
  files:[pom('nacos',dep('com.alibaba.nacos','nacos-client','2.4.3')),envFile,
    java('NacosSupport',String.raw`package demo;
import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.config.ConfigService;
import java.io.StringReader;
import java.util.Properties;
public final class NacosSupport {
  static final String GROUP = "DEMO_AGENT";
  static final String CORE = "demo-agent-retrieval-core.properties";
  static final String SCENARIO = "demo-agent-retrieval-scenario.properties";
  record Policy(int topK, String version) {}
  private NacosSupport() {}
  static ConfigService connect() throws Exception {
    var properties = new Properties();
    properties.setProperty("serverAddr", Env.get("NACOS_SERVER", "localhost:8848"));
    properties.setProperty("namespace", Env.get("NACOS_NAMESPACE_ID", ""));
    String username = Env.get("NACOS_USER", "");
    if (!username.isBlank()) {
      properties.setProperty("username", username);
      properties.setProperty("password", Env.required("NACOS_PASSWORD"));
    }
    return NacosFactory.createConfigService(properties);
  }
  static String content(int topK, String version) {
    return "topK=" + topK + "\nversion=" + version + "\n";
  }
  static void publish(ConfigService service, String id, String content) throws Exception {
    if (!service.publishConfig(id, GROUP, content))
      throw new IllegalStateException("配置发布未成功: " + id);
  }
  static Policy parse(String content) throws Exception {
    if (content == null) throw new IllegalArgumentException("配置缺失");
    var p = new Properties();
    p.load(new StringReader(content));
    int k = Integer.parseInt(p.getProperty("topK", "0"));
    if (k < 1 || k > 20) throw new IllegalArgumentException("topK 必须在 1..20");
    String version = p.getProperty("version", "");
    if (version.isBlank()) throw new IllegalArgumentException("需要配置版本");
    return new Policy(k, version);
  }
}`),
    java('ConnectDemo',String.raw`package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var service = NacosSupport.connect();
    try {
      System.out.println("serverStatus=" + service.getServerStatus());
      String value = service.getConfig(NacosSupport.CORE, NacosSupport.GROUP, 5000);
      System.out.println(value == null ? "config absent: 请先执行 CoreDemo" : value);
    } finally { service.shutDown(); }
  }
}`),
    java('CoreDemo',String.raw`package demo;
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
}`),
    java('ScenarioDemo',String.raw`package demo;
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
}`)],
  sources:[{label:'Nacos：Java SDK 配置读取、发布与监听',url:'https://nacos.io/en/docs/latest/manual/user/java-sdk/usage/'},{label:'Nacos Java SDK 源码与版本',url:'https://github.com/alibaba/nacos/tree/2.4.3/client'}]
};

const observability = {
  id:'observability',title:'OpenTelemetry：真实 Trace、错误与异步上下文',
  summary:'显式创建 SDK、Provider、Exporter 与 Tracer；从本地 Span 日志开始，再将 Agent 流程通过 OTLP HTTP 导出到已有后端。',
  scenario:'给知识助手的检索、模型和工具三个步骤建 Trace。步骤内容是固定教学实现，不调用真实模型；Span 创建、上下文传播与导出使用真实 OTel SDK。',
  prerequisites:[base,'OpenTelemetry API、SDK、Logging Exporter、OTLP Exporter 均锁定 1.44.0。只引入 API 不会自动得到可查看的链路。','接入/核心阶段无需外部服务，LoggingSpanExporter 输出实际 Span；场景阶段要求已有 Collector 或支持 OTLP HTTP 的后端。','DEMO_OTLP_ENDPOINT 填完整 traces URL，例如 http://localhost:4318/v1/traces；这是 HTTP/protobuf，不是 gRPC 4317。'],
  environment:[{name:'DEMO_OTLP_ENDPOINT',example:'http://localhost:4318/v1/traces',description:'场景阶段必填；核心阶段可不设，只看日志。'},{name:'DEMO_OTLP_AUTHORIZATION',example:'Bearer <后端凭据>',description:'可选完整 Authorization 头值；用服务端颁发的凭据，不打印。'},{name:'DEMO_TOOL_FAIL',example:'true',description:'场景工具默认模拟异常，让工具 Span 和根 Span 标记 ERROR；false 观察正常路径。'}],
  stages:[
    stage('connect','基础接入 · SDK 与一个真实 Span','构造 SDK/provider/exporter 并结束 Span，关闭前 flush；默认在控制台看到导出日志。',['API 与 SDK 的区别','Span 必须 end 才完成','flush 后正常 shutdown'],[run('ConnectDemo')],['打印有效 traceId 和 connect Span 的日志记录。'],['看不到 Span：确认不是只初始化 API、Span 已 end、SDK 实例被实际使用；这里不依赖全局自动探针。'],['ConnectDemo','Telemetry']),
    stage('core','核心功能 · 父子 Span 与异常记录','建立父 Span，再创建成功和失败的子 Span。recordException 记录异常事件，setStatus(ERROR) 标记状态。',['makeCurrent 传递父上下文','try/finally 确保结束','异常记录与错误状态是两个动作'],[run('CoreDemo')],['同一 traceId 下出现 core-parent、core-success 和 core-failure，失败子 Span 为 ERROR。'],['子 Span 变成不同 Trace 时查 Scope 是否覆盖实际工作；不在日志中记录密钥和用户原文。'],['CoreDemo','Telemetry']),
    stage('scenario','场景应用 · 检索→模型→异步工具 Trace','配置实际 OTLP HTTP 接收端；检索和模型在当前线程，工具在线程池中用 Context.wrap 传播父上下文。',['模型/Prompt/片段 ID 使用自定义 app.* 属性','线程池不自动继承 OTel 上下文','导出成功以 exporter 和后端双方证据判断'],[run('ScenarioDemo')],['控制台打印 taskId、traceId；后端应看到 agent.request 的 retrieval、generation、tool 子 Span。默认工具失败是预期演示。'],['HTTP 404 查 /v1/traces 路径；401/403 查凭据；协议错误查是否错用了 gRPC 地址。','日志有 Span 但后端没有：查 exporter 报错、Collector pipeline 与采样；flush 超时不等于后端已收到。'],['ScenarioDemo','Telemetry'])
  ],
  files:[pom('observability',dep('io.opentelemetry','opentelemetry-api','1.44.0')+dep('io.opentelemetry','opentelemetry-sdk','1.44.0')+dep('io.opentelemetry','opentelemetry-exporter-logging','1.44.0')+dep('io.opentelemetry','opentelemetry-exporter-otlp','1.44.0')),envFile,
    java('Telemetry',String.raw`package demo;
import io.opentelemetry.api.common.*;
import io.opentelemetry.api.trace.*;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.*;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import io.opentelemetry.exporter.logging.LoggingSpanExporter;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.context.Scope;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
public final class Telemetry implements AutoCloseable {
  final SdkTracerProvider provider;
  final Tracer tracer;
  Telemetry() {
    var builder = SdkTracerProvider.builder().setSampler(Sampler.alwaysOn())
      .setResource(Resource.create(Attributes.of(AttributeKey.stringKey("service.name"), "demo-agent-java")))
      .addSpanProcessor(SimpleSpanProcessor.create(LoggingSpanExporter.create()));
    String endpoint = Env.get("DEMO_OTLP_ENDPOINT", "");
    if (!endpoint.isBlank()) {
      var exporter = OtlpHttpSpanExporter.builder().setEndpoint(endpoint)
        .setTimeout(Duration.ofSeconds(5));
      String authorization = Env.get("DEMO_OTLP_AUTHORIZATION", "");
      if (!authorization.isBlank()) exporter.addHeader("Authorization", authorization);
      builder.addSpanProcessor(BatchSpanProcessor.builder(exporter.build()).build());
    }
    provider = builder.build();
    var sdk = OpenTelemetrySdk.builder().setTracerProvider(provider).build();
    tracer = sdk.getTracer("demo.agent", "1.0.0");
  }
  <T> T step(String name, Supplier<T> action) {
    Span span = tracer.spanBuilder(name).startSpan();
    try (Scope scope = span.makeCurrent()) {
      return action.get();
    } catch (RuntimeException failure) {
      span.recordException(failure);
      span.setStatus(StatusCode.ERROR, failure.getClass().getSimpleName());
      throw failure;
    } finally { span.end(); }
  }
  public void close() {
    var flushed = provider.forceFlush().join(10, TimeUnit.SECONDS);
    System.out.println("flush success=" + flushed.isSuccess());
    provider.shutdown().join(10, TimeUnit.SECONDS);
  }
}`),
    java('ConnectDemo',String.raw`package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var telemetry = new Telemetry()) {
      var span = telemetry.tracer.spanBuilder("demo.connect").startSpan();
      try {
        span.setAttribute("app.demo", true);
        System.out.println("traceId=" + span.getSpanContext().getTraceId());
      } finally { span.end(); }
    }
  }
}`),
    java('CoreDemo',String.raw`package demo;
import io.opentelemetry.context.Scope;
public class CoreDemo {
  public static void main(String[] args) {
    try (var telemetry = new Telemetry()) {
      var parent = telemetry.tracer.spanBuilder("core-parent").startSpan();
      try (Scope scope = parent.makeCurrent()) {
        telemetry.step("core-success", () -> "ok");
        try {
          telemetry.step("core-failure", () -> { throw new IllegalStateException("演示异常"); });
        } catch (IllegalStateException expected) {
          parent.addEvent("child failure handled");
          System.out.println("预期错误已捕获，查看失败子 Span");
        }
        System.out.println("traceId=" + parent.getSpanContext().getTraceId());
      } finally { parent.end(); }
    }
  }
}`),
    java('ScenarioDemo',String.raw`package demo;
import io.opentelemetry.api.trace.*;
import io.opentelemetry.context.*;
import java.util.*;
import java.util.concurrent.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    Env.required("DEMO_OTLP_ENDPOINT");
    ExecutorService pool = Executors.newSingleThreadExecutor();
    try (var telemetry = new Telemetry()) {
      String taskId = "demo-task-" + UUID.randomUUID();
      Span root = telemetry.tracer.spanBuilder("agent.request").startSpan();
      try (Scope scope = root.makeCurrent()) {
        root.setAttribute("app.task.id", taskId);
        System.out.println("taskId=" + taskId + " traceId=" + root.getSpanContext().getTraceId());
        String evidence = telemetry.step("retrieval", () -> {
          Span.current().setAttribute("app.retrieval.chunk_id", "demo-policy-v2");
          Span.current().setAttribute("app.retrieval.count", 1L);
          return "演示制度片段";
        });
        String answer = telemetry.step("generation", () -> {
          Span.current().setAttribute("app.model", "toy-no-model-call");
          Span.current().setAttribute("app.prompt.version", "demo-v1");
          return "根据固定资料生成的教学回答: " + evidence;
        });
        Callable<String> action = () -> telemetry.step("tool", () -> {
          Span.current().setAttribute("app.tool.name", "demo.createDraft");
          if (Boolean.parseBoolean(Env.get("DEMO_TOOL_FAIL", "true")))
            throw new IllegalStateException("演示工具失败，没有执行真实写操作");
          return "toy draft created";
        });
        try {
          String result = pool.submit(Context.current().wrap(action)).get(10, TimeUnit.SECONDS);
          System.out.println(answer + " | " + result);
        } catch (ExecutionException expected) {
          root.recordException(expected.getCause());
          root.setStatus(StatusCode.ERROR, "tool_failed");
          System.out.println("任务未完成：默认工具失败演示");
        }
      } catch (Exception failure) {
        root.recordException(failure);
        root.setStatus(StatusCode.ERROR);
        throw failure;
      } finally { root.end(); }
    } finally { pool.shutdownNow(); }
  }
}`)],
  sources:[{label:'OpenTelemetry Java：SDK、Provider 与 Exporter',url:'https://opentelemetry.io/docs/languages/java/sdk/'},{label:'OpenTelemetry Java：手动埋点与上下文',url:'https://opentelemetry.io/docs/languages/java/instrumentation/'}]
};

export const executionDemos = [kafka, rocketmq, rabbitmq, temporal, nacos, observability];
