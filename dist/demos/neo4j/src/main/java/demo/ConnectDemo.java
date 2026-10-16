package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var driver = GraphSupport.open()) {
      driver.verifyConnectivity(); System.out.println("connected=true");
      try (var session = GraphSupport.session(driver)) {
        GraphSupport.schema(session);
        System.out.println("ping=" + session.run("RETURN 1 AS ping").single().get("ping").asInt());
      }
    }
  }
}
