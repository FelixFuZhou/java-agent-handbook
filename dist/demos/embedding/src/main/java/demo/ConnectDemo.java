package demo;
import java.util.*;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    double[] vector = Embeddings.encode(List.of("企业知识库连接验证"), "document").get(0);
    System.out.println("model=" + Embeddings.model() + " dimensions=" + vector.length);
    System.out.println(Arrays.toString(Arrays.copyOf(vector, 5)));
  }
}
