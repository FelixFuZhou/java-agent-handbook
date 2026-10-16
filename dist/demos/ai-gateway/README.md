# AI 网关：统一调用、错误分类与降级

用 JDK HttpClient 接入已配置好的 Higress 路由，观察模型代理的响应，再给知识助手增加有限的降级策略。

## 场景

知识助手调用主模型失败时，按明确的错误类型切换备用路由，记录同一个请求标识。

## 运行前提

- JDK 17+、Maven 3.6.3+；依赖 Jackson 2.18.2。
- 准备已有 Higress AI 网关及可用模型供应商凭据。在控制台“AI 服务提供者”配置凭据，再在“AI 路由”映射主模型和备用模型。
- 为网关入口配置认证，AI_GATEWAY_KEY 填入口调用凭据，供应商 Key 留在网关；URL 指向网关，不是本站。例子使用非流式文本生成。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 网关地址，不包含 /v1；按实际监听端口修改。
export AI_GATEWAY_URL='http://localhost:9080'
# 经认证的应用凭据；不用供应商 Key 代替。
export AI_GATEWAY_KEY='<网关颁发的调用凭据>'
# 已在网关配置的主模型名或别名。
export AI_MODEL='qwen-plus'
# 已配置的备用模型路由，输出与成本可能不同。
export AI_FALLBACK_MODEL='deepseek-chat'
```

## 01 基础接入 · 发起一次模型请求

入口 URL 和模型名都可配置；解析 choices 和 usage，先确认网关实际转发成功。

- 模型名必须与网关路由匹配
- 设置连接/请求超时，检查 HTTP 状态

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Gateway.java](src/main/java/demo/Gateway.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 token usage 和模型回答；内容由远端模型决定。

排障：

- 401/403 先查网关入口认证和应用权限；404 查路由前缀及模型映射。

## 02 核心功能 · 观察限流与响应标识

分类 429、鉴权错误与服务端错误。网关负责共享配额；Java 调用方把错误变成可操作的信息。

- 读取 Retry-After，不把 429 当成功
- 不记录 Key 和完整用户提示词

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Gateway.java](src/main/java/demo/Gateway.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 打印 HTTP 状态、Retry-After（未限流时通常为空）和网关响应标识。
- 可在控制台给演示应用设置很小的请求配额后重跑，观察 429；代码本身不会制造流量洪峰。

排障：

- 没有 429 不代表配额已配置，核对插件作用域；不同网关的请求标识头可能不同。

## 03 场景应用 · 知识助手有限降级

仅遇到明确的 502/503/504 HTTP 响应时切备用路由一次。超时和连接中断结果不确定，向上层暴露，不盲目重放。

- 同一 requestId 串起两次模型调用
- 最多一次备用调用；网关若已做 fallback，应用层应关闭重复策略
- 模型降级不重做检索、不执行退款等业务副作用

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Gateway.java](src/main/java/demo/Gateway.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 正常情况下打印主模型回答；主路由返回 502/503/504 时打印 fallback，再调用备用路由。

排障：

- 两个模型必须都配置可访问；429 应按配额策略处理，此处不会绕过限流。
- 这是代理调用示例，输入知识片段是固定演示数据；真实知识助手从有权限的检索结果构造上下文。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Higress 多模型代理与路由配置](https://higress.io/docs/ai/scene-guide/multi-proxy/)
- [JDK HttpClient](https://docs.oracle.com/en/java/javase/17/docs/api/java.net.http/java/net/http/HttpClient.html)
