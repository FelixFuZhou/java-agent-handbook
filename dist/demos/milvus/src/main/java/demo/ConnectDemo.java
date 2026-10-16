package demo;
import java.util.*;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    System.out.println(MilvusStore.call("collections/list", Map.of()));
  }
}
