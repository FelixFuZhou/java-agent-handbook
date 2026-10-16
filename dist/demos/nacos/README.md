# Nacos：配置读取、监听与安全生效

用真实 Java ConfigService 读取和发布教学配置；监听到变更以后先校验，再原子替换应用内策略。

## 场景

知识助手动态调整检索 topK。配置存于真实 Nacos，候选文档用固定列表演示；非法配置被拒绝，应用保留上一个有效策略。

## 运行前提

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 nacos-client 2.4.3；准备兼容的 Nacos 服务端与专用学习 Namespace。需读取、发布和监听 demo 配置的权限。
- 本地默认 HTTP 端口 8848；Nacos 2.x 客户端还需要 gRPC 端口可达，默认相对主端口偏移 +1000，即 9848。按实际部署核对。
- 示例会创建或更新 DEMO_AGENT 组内 demo-agent-retrieval-core.properties 与 scenario.properties；不要用生产配置标识。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# Nacos serverAddr。
export NACOS_SERVER='localhost:8848'
# 实际 Namespace ID；留空表示默认空间，不是显示名称。
export NACOS_NAMESPACE_ID=''
# 启用认证时配置账号；未启用时可不设置。
export NACOS_USER='<学习账号>'
# 与账号一起由环境注入，代码不打印。
export NACOS_PASSWORD='<账号密码>'
```

## 01 基础接入 · 读取配置快照

连接 ConfigService，读取固定教学 Data ID；首次不存在时明确显示不存在。

- 服务地址、Namespace、Group、Data ID 四项定位
- 读取到 null 与请求失败不同

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/NacosSupport.java](src/main/java/demo/NacosSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 serverStatus；首次打印 config absent，核心阶段执行后可看到配置正文。

排障：

- 权限错误查账号；读取为空查 Namespace ID、Group 与 Data ID；HTTP 通但监听失败查 gRPC 端口。

## 02 核心功能 · 发布并监听变更

先发布基线，再使用 getConfigAndSignListener 获取快照和注册 Listener，更新内容并等待通知。

- getConfig 只是读取
- Listener 才处理后续变化
- 退出前移除监听并 shutdown

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/NacosSupport.java](src/main/java/demo/NacosSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 打印 initial、CHANGED；未收到变更会在 15 秒后报错。

排障：

- 重复发布相同正文可能没有新通知；本例用唯一 revision 区分。多实例生效并非同时完成。

## 03 场景应用 · 非法 topK 保留旧值

动态发布 topK=999，Listener 拒绝；再发布 topK=6，校验后更新 AtomicReference，toy 检索使用新的快照。

- 校验范围后原子切换不可变策略
- 读取一次策略快照用于一次请求
- 配置版本可以进入调用日志

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/NacosSupport.java](src/main/java/demo/NacosSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印 REJECTED、active topK=3、APPLIED demo-v2；最终取出 6 个教学文档。

排障：

- 收到配置不等于对象更新：检查 Listener、解析与实际读取的 AtomicReference。
- 该示例发布配置用于学习，真实发布权限与运行时只读身份应分开。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Nacos：Java SDK 配置读取、发布与监听](https://nacos.io/en/docs/latest/manual/user/java-sdk/usage/)
- [Nacos Java SDK 源码与版本](https://github.com/alibaba/nacos/tree/2.4.3/client)
