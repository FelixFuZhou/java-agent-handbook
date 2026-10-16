package demo;

public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var info = ElasticStore.call("GET", "/", null);
    System.out.println("cluster=" + info.path("cluster_name").asText() + " version=" + info.path("version").path("number").asText());
  }
}
