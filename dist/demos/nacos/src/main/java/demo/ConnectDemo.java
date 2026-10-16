package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var service = NacosSupport.connect();
    try {
      System.out.println("serverStatus=" + service.getServerStatus());
      String value = service.getConfig(NacosSupport.CORE, NacosSupport.GROUP, 5000);
      System.out.println(value == null ? "config absent: 请先执行 CoreDemo" : value);
    } finally { service.shutDown(); }
  }
}
