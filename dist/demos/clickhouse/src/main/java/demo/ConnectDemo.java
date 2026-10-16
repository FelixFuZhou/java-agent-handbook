package demo;
import java.util.Map;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    System.out.println(ClickSupport.sql("SELECT version() FORMAT TabSeparated",Map.of()));
    ClickSupport.schema();
    System.out.println("demo table ready");
  }
}
