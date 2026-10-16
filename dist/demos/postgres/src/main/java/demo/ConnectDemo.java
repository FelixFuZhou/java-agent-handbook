package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    try (var c = Db.open()) {
      var m = c.getMetaData();
      System.out.println(m.getDatabaseProductName() + " " + m.getDatabaseProductVersion());
      Db.schema(c);
      System.out.println("demo tables ready");
    }
  }
}
