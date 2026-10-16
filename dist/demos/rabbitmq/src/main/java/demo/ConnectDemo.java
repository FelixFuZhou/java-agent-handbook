package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    try (var connection = RabbitSupport.connect(); var channel = connection.createChannel()) {
      System.out.println("connected=" + connection.isOpen() + " channel=" + channel.getChannelNumber());
    }
  }
}
