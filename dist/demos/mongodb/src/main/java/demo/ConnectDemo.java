package demo;
import org.bson.Document;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var client = MongoSupport.open()) {
      System.out.println(client.getDatabase("demo_agent").runCommand(new Document("ping",1)).toJson());
      MongoSupport.schema(client);
      System.out.println("demo indexes ready");
    }
  }
}
