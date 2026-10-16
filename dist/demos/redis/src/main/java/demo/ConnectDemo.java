package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var jedis = RedisSupport.open()) {
      System.out.println(jedis.ping());
    }
  }
}
