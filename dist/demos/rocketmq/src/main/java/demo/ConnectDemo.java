package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var producer = RocketSupport.producer("connect");
    try {
      System.out.println("queues=" + producer.fetchPublishMessageQueues(RocketSupport.topic()));
    } finally { producer.shutdown(); }
  }
}
