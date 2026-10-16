package demo;

public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    try (var c = PgStore.connect(); var s = c.createStatement()) {
      try (var r = s.executeQuery("SELECT version()")) { r.next(); System.out.println(r.getString(1)); }
      try (var r = s.executeQuery("SELECT extversion FROM pg_extension WHERE extname='vector'")) {
        System.out.println(r.next() ? "vector=" + r.getString(1) : "vector not enabled");
      }
    }
  }
}
