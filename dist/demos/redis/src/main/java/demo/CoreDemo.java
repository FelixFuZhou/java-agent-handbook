package demo;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) {
    try (var jedis = RedisSupport.open()) {
      String cache = RedisSupport.key("demo_alpha","core:" + UUID.randomUUID());
      jedis.setex(cache,60,"demo answer");
      System.out.println("value=" + jedis.get(cache) + " ttl=" + jedis.ttl(cache));
      String action = "core_" + UUID.randomUUID();
      for (int i=1;i<=4;i++) {
        boolean allowed = RedisSupport.allow(jedis,"demo_alpha",action,3,60);
        System.out.println("request " + i + " allowed=" + allowed);
      }
      // 只清理本次缓存；计数键由 TTL 自动清理。
      jedis.del(cache);
    }
  }
}
