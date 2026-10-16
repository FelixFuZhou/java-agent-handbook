// Demo 项目的通用构造函数；输出始终是可下载的静态文本。
export const file = (path, language, code) => ({ path, language, code: code.trim() + '\n' });
export const java = (name, code) => file(`src/main/java/demo/${name}.java`, 'java', code);
export const pom = (id, dependencies = '') => file('pom.xml', 'xml', `
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>dev.agent.handbook</groupId><artifactId>${id}-demo</artifactId><version>1.0.0</version>
  <properties><maven.compiler.release>17</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties>
  <dependencies>${dependencies}</dependencies>
  <build><plugins>
    <plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin>
    <plugin><groupId>org.codehaus.mojo</groupId><artifactId>exec-maven-plugin</artifactId><version>3.5.0</version></plugin>
  </plugins></build>
</project>`);
export const dep = (group, artifact, version) => `<dependency><groupId>${group}</groupId><artifactId>${artifact}</artifactId><version>${version}</version></dependency>`;
export const envFile = java('Env', `
package demo;
public final class Env {
  private Env() {}
  public static String get(String key, String fallback) {
    String value = System.getenv(key);
    return value == null || value.isBlank() ? fallback : value;
  }
  public static String required(String key) {
    String value = get(key, "");
    if (value.isBlank()) throw new IllegalArgumentException("请配置环境变量 " + key);
    return value;
  }
}`);
export const run = name => `mvn -q compile exec:java -Dexec.mainClass=demo.${name}`;
