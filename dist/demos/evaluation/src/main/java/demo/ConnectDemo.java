package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var samples = Samples.load(); System.out.println("loaded=" + samples.size()); samples.forEach(System.out::println);
  }
}
