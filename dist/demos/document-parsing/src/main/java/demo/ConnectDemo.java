package demo;
import org.apache.tika.Tika;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var path = Documents.input(); var bytes = Documents.bytes(path);
    System.out.println("bytes=" + bytes.length + " sha256=" + Documents.sha(bytes));
    System.out.println("mime=" + new Tika().detect(bytes, path.getFileName().toString()));
  }
}
