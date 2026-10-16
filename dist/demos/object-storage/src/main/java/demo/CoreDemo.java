package demo;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    try (var s3 = S3Support.client()) {
      String key = S3Support.key("demo_alpha","demo_policy_v1.md");
      String content = "# 报销制度 v1\n差旅返回后30天内提交材料。";
      String sha = S3Support.put(s3,key,content);
      var loaded = s3.getObjectAsBytes(r -> r.bucket(S3Support.bucket()).key(key));
      System.out.println("sha256=" + sha);
      System.out.println("metadataMatch=" + sha.equals(loaded.response().metadata().get("sha256")));
      System.out.println("contentMatch=" + content.equals(loaded.asUtf8String()));
      if (!content.equals(loaded.asUtf8String())) throw new IllegalStateException("内容不匹配");
    }
  }
}
