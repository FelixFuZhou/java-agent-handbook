package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var s3 = S3Support.client()) {
      s3.headBucket(r -> r.bucket(S3Support.bucket()));
      System.out.println("private demo bucket reachable");
      // HeadBucket 证明访问成功；是否私有必须由桶策略配置保证。
    }
  }
}
