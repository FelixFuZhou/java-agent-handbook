package demo;
public final class Env {
  private Env() {}
  public static String get(String key, String fallback) {
    String value = System.getenv(key);
    return value == null || value.isBlank() ? fallback : value;
  }
  public static String required(String key) {
    String value = get(key, "");
    if (value.isBlank()) throw new IllegalArgumentException("请配置环境变量 " + key);
    return value;
  }
}
