package demo;
import java.util.List;
import java.util.UUID;
public class ScenarioDemo {
  public static void main(String[] args) {
    try (var jedis = RedisSupport.open()) {
      String version = "demo_policy_v1";
      String action = "ask_" + UUID.randomUUID();
      for (String tenant : List.of("demo_alpha","demo_beta")) {
        jedis.del(RedisSupport.key(tenant,"cache:policy:" + version));
        for (int i=0;i<3;i++) {
          if (!RedisSupport.allow(jedis,tenant,action,2,60)) {
            System.out.println("tenant=" + tenant + " 已限流，不调用下游"); continue;
          }
          System.out.println(tenant + " -> " + RedisSupport.cachedPolicy(jedis,tenant,version));
        }
      }
      System.out.println("缓存只加速读取；任务结果仍需持久化到账本。");
    }
  }
}
