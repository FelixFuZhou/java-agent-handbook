# 对象存储：上传、校验与私有下载

使用锁定版本的 AWS SDK v2 访问已有 S3 兼容存储，保存文档和校验摘要，并在鉴权后生成短时下载地址。

## 场景

知识助手保留原始文档版本，Java 服务校验租户后向用户交付私有产物；对象 URL 不作为永久公开链接。

## 运行前提

- JDK 17+、Maven 3.6.3+；AWS SDK for Java 2.30.31。
- 准备可访问的 S3 兼容服务（例如已有 Ceph RGW）或 S3，预先创建私有 demo-agent-learning 桶；不使用公开读策略。该项目不创建桶、不启动存储服务。
- 凭据仅需演示桶的 HeadBucket/ListBucket 及 demo_agent/* 的 PutObject、GetObject 权限。下载签名和上传必须使用相同 endpoint 与 region。
- 所有 Object Key 限定 demo_agent/；S3 桶不能含下划线，故桶名前缀使用 demo-。不删除用户对象；演示文本大小仅几十字节。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 已有服务的可访问 S3 端点；使用真实 TLS 服务时填 https://，不关闭证书验证。
export DEMO_S3_ENDPOINT='http://localhost:9000'
# 必须匹配提供方的签名区域。
export DEMO_S3_REGION='us-east-1'
# 已存在的私有学习桶，代码要求 demo- 前缀。
export DEMO_S3_BUCKET='demo-agent-learning'
# 仅访问教学桶和前缀。
export DEMO_S3_ACCESS_KEY='<学习凭据 Access Key>'
# 环境注入，程序不打印密钥与签名 URL。
export DEMO_S3_SECRET_KEY='<学习凭据 Secret Key>'
```

## 01 基础接入 · 确认私有桶可访问

真实调用 HeadBucket，先区分连接、凭据、桶名称与区域错误。

- S3 兼容不代表所有扩展行为一致
- 凭据与 endpoint 都在环境变量中

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/S3Support.java](src/main/java/demo/S3Support.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 private demo bucket reachable。

排障：

- 403：检查桶权限和签名区域；404：确认桶已经创建。
- SignatureDoesNotMatch：检查 region、endpoint、时钟偏移和代理重写，勿靠公开桶绕过。

## 02 核心功能 · 上传与读取校验

上传固定教学 Markdown，再读取对象内容和用户元数据，计算 SHA-256 并比对。

- 保存原件与内容摘要
- ETag 不一定是文件 MD5
- 读取内容而不只检查 HTTP 成功

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/S3Support.java](src/main/java/demo/S3Support.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 输出 sha256=... 与 metadataMatch=true、contentMatch=true。

排障：

- 兼容服务返回校验和相关错误：核对服务支持的 SDK 请求能力和服务版本。
- 同名 Key 重跑会覆盖教学对象；生产版本通过明确版本路径或存储版本功能管理。

## 03 场景应用 · 鉴权后私有下载

上传两个租户的教学资料；先拒绝跨租户请求，再签名当前租户对象并通过 HTTP 下载。

- 身份在服务端确定，不能由模型声明
- 签名有效60秒，不打印 URL
- 短时链接在有效期内仍应按凭据保护

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/S3Support.java](src/main/java/demo/S3Support.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印跨租户拒绝信息，随后 signed download status=200 与当前租户文档内容。

排障：

- 签名地址使用容器内部主机名时，外部客户端可能不可达；endpoint 必须对下载方可访问。
- 403 也可能是桶策略或签名过期；不要缓存签名地址超过其有效期。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [AWS SDK Java：预签名 URL](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html)
- [AWS S3Client API](https://sdk.amazonaws.com/java/api/latest/software/amazon/awssdk/services/s3/S3Client.html)
