# 后端运行态质量检查报告（runtime QC）

- 检查对象：`D:\DSH_vue\dfg\demo`（Spring Boot 4.0.8 + Java 25 + MyBatis + Druid + MySQL）
- 检查范围：仅后端运行态（构建 / 启动 / HTTP 冒烟 / 日志 / 数据一致性）；前端不在本报告范围
- 检查日期：2026-11-21 16:22 ~ 16:31（本地时间）
- 执行方式：真实构建、真实启动、真实 HTTP 请求、真实 MySQL 读写；未修改任何源码 / 配置 / env 文件
- 静态基准：`docs/后端代码质量审计报告.md`（2026-11-21）中的 P0-1 ~ P2-14 条目在缺陷清单里做映射
- 原始证据目录：`D:\DSH_vue\dfg\.qc\runtime\`（下文路径均相对该目录）

---

## 0. 结论摘要

| 维度 | 结论 | 关键依据 |
|---|---|---|
| 构建 `mvn -o -B clean package` | **PASS** | BUILD SUCCESS，35 源文件编译，3 个测试全通过，jar 50,376,940 字节；mapper XML 打包位置正确、无旧包名/大写目录残留 |
| 启动 | **PASS** | `Started DemoApplication in 3.381 seconds`，Tomcat 11.0.24 监听 18080，启动阶段无 WARN/ERROR、无 Bean 创建失败 |
| 运行功能 | **FAIL（阻塞）** | 认证链路整体不可用：**正确密码登录必然 500**（P0-1）；即便绕过该异常，**登录签发的 token 必然验签失败**（P0-2）。所有需登录接口在真实前端流程下无法访问 |
| 数据一致性 | **FAIL（非阻塞）** | 删除照片先删库行再 OSS 抛异常，客户端收到"删除错误"但数据已删（P1-4）；越权写返回假成功（P1-3） |
| 数据清理 | **PASS** | 探针用户 4 个、纪念日 1 行、照片 4 行已删除；`tb_use=25 / anneriversaries=2 / photo=1 / birth=1` 与基线完全一致，原用户 12 数据未动 |

缺陷计数：**P0 × 2、P1 × 10、P2 × 10**（其中 P2 含行为确认/信息项）。**阻塞级（P0）= 2 条，均属认证链路。**

环境：JDK Temurin 25.0.2+10、Maven 3.9.15（离线仓库 D:\maven\repository）、MySQL 8.4.11、客户端 mysql 8.0、Spring Boot 4.0.8、Tomcat 11.0.24。

---

## 1. A. 构建产物检查

命令（CWD=`demo/`，离线模式）：

```
mvn -o -B clean package
```

实际结果（完整日志 `build.log`）：

- `BUILD SUCCESS`，Total time: **33.313 s**；`Compiling 35 source files with javac [debug parameters release 21]`（pom `java.version=21`，实际 JDK 25 编译到 release 21，兼容）。
- 测试：`Tests run: 3, Failures: 0, Errors: 0, Skipped: 0`
  - `DemoApplicationTests.contextLoads()` 启动完整 Spring 上下文（profile `test`）3.711 s 通过；
  - `UserJsonTest` 2 个用例通过（新增序列化测试有效）。
- 产物：`target/demo-0.0.1-SNAPSHOT.jar` = **50,376,940 B**。
- 编译 warning：仅 2 类第三方告警，无业务代码告警：
  1. `WARNING: A terminally deprecated method in sun.misc.Unsafe has been called ... called by lombok.permit.Permit`（Lombok 在 JDK 25 下的已知告警）；
  2. Mockito self-attach / ByteBuddy `dynamic agent loading is not enabled`（仅测试阶段 JVM 告警）。
  无 javac deprecation / unchecked 告警。

Mapper XML 打包位置（`jar tf target/demo-0.0.1-SNAPSHOT.jar | grep -i mapper`，清单存 `jar_mapper_entries.txt`）：

```
BOOT-INF/classes/com/wei/mapper/AnniversariesMapper.class
BOOT-INF/classes/com/wei/mapper/AnniversariesMapper.xml
BOOT-INF/classes/com/wei/mapper/BirthdayMapper.class
BOOT-INF/classes/com/wei/mapper/LoginMapper.class
BOOT-INF/classes/com/wei/mapper/PhotoMapper.class
BOOT-INF/classes/com/wei/mapper/PhotoMapper.xml
```

- XML 位于**小写** `com/wei/mapper/` 且与 `mapper-locations: classpath:com/wei/mapper/*.xml` 匹配 → 静态审计 **P0-2（大写 Mapper 目录导致 XML 全部失效）在运行态已不成立**（PASS）。
- 旧包名/大写残留检查（`jar_uppercase_residue.txt`、`jar_oldpkg_residue.txt`）：仅 `com/wei/DemoApplication.class`、`com/wei/ServletInitializer.class` 为根类；包目录全部小写（config、controller、exceptionhander、interceptor、mapper、pojo、result、service、util）。**无大写包名残留、无旧包名残留**（PASS）。`target/classes/com/wei/mapper/` 下同样有 2 个 XML，本地运行也命中。

## 2. B. 启动检查

启动命令（CWD=`demo/`，保证 `env/dev.env` 被 `config.import` 读到）：

```
nohup java -jar target/demo-0.0.1-SNAPSHOT.jar --server.port=18080 > .qc/runtime/app.log 2>&1 &
```

关键日志（`app.log`）：

```
No active profile set, falling back to 1 default profile: "dev"
Tomcat initialized with port 18080 (http)
Tomcat started on port 18080 (http) with context path '/'
Started DemoApplication in 3.381 seconds (process running for 3.994)
```

- 启动耗时 **3.381 s**（进程 3.994 s），Tomcat **11.0.24**；`DevTools` 未启用（jar 启动）。
- 启动阶段 WARN/ERROR：**0 条**；无 Bean 创建失败、无数据源连接失败（Druid 首次请求时惰性初始化 `{dataSource-1} inited`）。
- Mapper 加载：`/anniversaries`、`/photos` 等接口真实命中 XML 中的 SQL 并返回数据（见下文），说明 2 个 XML 语句均加载成功（否则会抛 `Invalid bound statement`）。
- Profile：application.yaml 未显式设置 `spring.profiles.active`，`config.import` 用 `${spring.profiles.active:dev}` 回退到 `dev`，`env/dev.env` 成功导入（DB 连接、JWT_SECRET、CF_SITEKEY 均生效）。
- 端口覆盖：`--server.port=18080` 生效（覆盖 yaml 中硬编码 8080）；另用临时实例验证 **`SERVER_PORT=18081` 环境变量同样生效**（`app2_port_jwt_test.log`：`Tomcat started on port 18081`）。所以"硬编码 8080"不是缺陷，只是默认值，CLI/env 可覆盖（P2-7 信息项）。

## 3. C. HTTP 冒烟逐项结果

所有请求的真实响应保存在 `curl/01 ~ curl/15`。**注意：除认证拦截器返回的 401 外，所有业务响应 HTTP 状态码恒为 200**（见 P1-1）。

| # | 检查项 | 请求 | 实际结果（HTTP + 关键片段） | 结论 |
|---|---|---|---|---|
| 1 | 无 token 访问受保护接口 | `GET /anniversaries` | **401**，`Content-Length: 0`，**空响应体** | 通过（拦截生效）；但空 body 属 P1-2 |
| 2 | 无 token 访问不存在路径 | `GET /nonexistent` | **401**，空体 | 通过 |
| 3 | 未登录访问健康检查 | `GET /actuator/health` | **200** `{"groups":["liveness","readiness"],"status":"UP"}` | 信息：拦截器未覆盖 actuator，health 无鉴权暴露；与静态 P2-4"应被 401 拦截"结论相反，见 P2-6 |
| 4 | 错误凭据登录 | `POST /auth/login` `{"userName":"lover","password":"x"}` | 200 `{"code":400,"message":"密码或用户名错误"}` | 通过（业务提示正确、无枚举差异） |
| 5 | 空体登录 | `POST /auth/login {}` | 200 `{"code":400,"message":"密码或用户名错误"}` | 通过 |
| 6 | 注册探针用户 A | `POST /auth/register` qc_probe_a_ee60c1fd | 200 `code:0`，data 中 `"id":null`、`"token":null`，**无 password / `$2a$` 字段** | 部分通过：WRITE_ONLY 生效无泄漏；但 id/token 为 null → P1-6 |
| 7 | 重复注册 | 同上再发一次 | 200 `{"code":400,"message":"用户名已存在"}` | 通过（先查重生效） |
| 8 | 注册探针用户 B | qc_probe_b_ee60c1fd | 200 `code:0`，id/token 同上 | 同上 |
| 9 | **正确凭据登录** | `POST /auth/login` A + `QcProbe@123` | **200 `{"code":500,"message":"服务端有异常"}`**；日志：`java.lang.RuntimeException: ... io.jsonwebtoken.io.DecodingException: Illegal base64url character: '+'` | **缺陷 P0-1（阻塞）** |
| 10 | 带合法签名 token 访问 | `GET /auth/profile`（ASCII 密钥伪造 token） | 200 `{"code":0,...,"data":{"userName":"qc_probe_a_...","id":29,...}}`，**无 password 字段** | 通过（profile 不泄漏密码；但 id 为真实 29 而 creatTime 为 null） |
| 11 | 带 token 列表 | `GET /anniversaries` | 200 `data:[]` | 通过 |
| 12 | 非法签名 token | `GET /auth/profile` bad sig | **401** 空体 | 通过 |
| 13 | 过期 token | 同上 exp 已过 | **401** 空体 | 通过 |
| 14 | 无 Bearer 前缀 / `alg:none` | 同上 | 均 **401** 空体 | 通过（伪造防护 OK） |
| 15 | 越权读取他人纪念日 | A `GET /anniversaries/49`（B 的） | 200 `{"code":0,"data":null}` | 未泄漏数据；但"成功语义"误导 → P1-3 |
| 16 | **越权修改** | A `PUT /anniversaries/49 {"title":"HACKED_BY_A"}` | 200 `{"code":0,"data":null}`；B 复查 `title` 仍为 `qc_probe_anniv_B`（**数据未被篡改**） | 数据隔离 OK（SQL 层 user_id 过滤生效），但返回假成功 → P1-3 |
| 17 | 越权删除 | A `DELETE /anniversaries/49` | 200 `{"code":404,"message":"纪念日不存在"}`，B 数据仍在 | 拒绝正确，但 HTTP 200 → P1-1 |
| 18 | 更新不存在的 id | A `PUT /anniversaries/999999` | 200 `{"code":0,"data":null}` | 假成功 → P1-3 |
| 19 | 删除不存在的 id | A `DELETE /anniversaries/999999` | 200 `{"code":404,"message":"纪念日不存在"}` | 语义正确、状态码错 → P1-1 |
| 20 | 正常新增/更新/删除自己 | `POST`→id 48；`PUT`→200 updated；`DELETE`→200 code:0 | 均正常，updatedAt 更新 | 通过 |
| 21 | 创建重复 title | `POST /anniversaries` 同 title | 200 `{"code":400,"message":"title重复"}` | 通过（业务提示可读） |
| 22 | title 超长（50 > varchar(20)） | `POST /anniversaries` | 200 `{"code":500,"message":"服务端有异常"}`（日志 DataIntegrityViolation，事务回滚，无脏行） | 错误映射差 → P1-1/P1-5 |
| 23 | 空响应结构 | `GET /photos`（无数据） | 200 `{"code":0,"data":"目前还没图片"}`（**字符串不是数组**） | **缺陷 P1-9** |
| 24 | 相册分页 | `GET /photos`（5 行探针数据） | 200 `{"hashMore":true,"list":[3 条 ids 52,51,50...]}` | 条数固定 3；`hashMore` 拼写 → P1-9 |
| 25 | 相册翻页 | `GET /photos?lastId=50` | 200 `{"hashMore":false,"list":[ids 49,48]}` | 翻页可用 |
| 26 | `limit` 参数 | `GET /photos?lastId=50&limit=3` | 与不传 limit 完全一致（SQL `LIMIT 3` 硬编码） | **limit 被忽略** → P1-9 |
| 27 | 非法 lastId | `GET /photos?lastId=abc` | 200 `{"code":500,"message":"服务端有异常"}` | 参数校验缺失 → P1-1 |
| 28 | 404 全局处理 | `GET /nonexistent`（带 token） | **200** `{"code":404,"message":"服务端有异常"}` | 状态码/文案双错 → P1-1 |
| 29 | 405 全局处理 | `PATCH /anniversaries`、`PUT /photos`、`GET /auth/login` | 均 **200** `{"code":500,...}` | 405 被吞 → P1-1 |
| 30 | 畸形 JSON / 错误日期 | `POST /anniversaries` 坏 body / `date:"not-a-date"` | 均 200 `{"code":500,...}` | P1-1/P1-5 |
| 31 | 上传：缺文件 | `POST /upload` 无 file | 200 `{"code":500,...}`（日志 MultipartException） | P1-5 |
| 32 | 上传：非图片 MIME | `POST /upload` text/plain | 200 `{"code":500,...}`（日志：`RuntimeException: 只允许 jpeg/png/webp/gif图片`，**提示被吞**） | P1-5 |
| 33 | 上传：无 OSS 凭据 | `POST /upload` 假 png | 200 `{"code":500,...}`（日志 `InvalidCredentialsException: Access key id should not be null or empty`） | 环境限制可接受；文案丢失 → P1-5 |
| 34 | 上传：超限 9MB | `POST /upload` 9MB png | 先 `HTTP 100`，再 200 `{"code":500,...}`（日志 `MaxUploadSizeExceededException`，应 413） | P1-1/P1-5 |
| 35 | CORS 预检 | `OPTIONS /anniversaries`（Origin + ACRM） | 200，仅 `Allow: GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH`，**无 Access-Control-Allow-Origin/Methods** | **缺陷 P1-10**（跨域部署必挂） |
| 36 | CORS 实际请求 | `GET /anniversaries` 带 Origin | 200，响应**无任何 CORS 头** | 同上 |
| 37 | Turnstile 校验 | `POST /welcome {"token":"fake-..."}` | 200 `{"code":400,"message":"Verification failed: [invalid-input-response]"}`（真实 Cloudflare 响应，出网正常） | 通过（无 NPE，见 P2-10） |
| 38 | 弱口令注册 | `POST /auth/register` password=`"1"` | 200 `code:0`（成功入库） | **缺陷 P1-7** |
| 39 | 缺 nickName 注册 | 无 nickName | 200 `code:0` | P1-7 |
| 40 | 空体注册 | `POST /auth/register {}` | 200 `{"code":500,...}`（日志 `IllegalArgumentException: rawPassword cannot be null`） | P1-7/P1-1 |
| 41 | 遗留用户登录 | `POST /auth/login` lover/123456（库中**明文**存储） | 200 `{"code":400,"message":"密码或用户名错误"}`；WARN `Encoded password does not look like BCrypt` | **缺陷 P2-1**（历史用户永久锁死） |
| 42 | 登录 SQL 注入串 | userName=`' OR '1'='1` | 200 `code:400`（参数化，无注入） | 通过 |
| 43 | 并发 ThreadLocal 隔离 | 12 个并行交替 A/B `GET /auth/profile` | 12 次返回的 id 全部与各自 token 一致（`curl/11_threadlocal.txt`） | 通过 |
| 44 | 生日模块 | `GET/POST /birth`、`/birthday`、`/birthdays` | 4 条路径全部 200 `{"code":404,"message":"服务端有异常"}` | **缺陷 P1-8**（模块整体无映射） |
| 45 | 已删除用户的 token | 删除探针用户后旧 token `GET /auth/profile` | **200** `{"code":401,"message":"toke缺失/无效/过期"}`；`GET /anniversaries` → 200 `data:[]` | 缺陷 P2-4（无吊销；两种 401 形态） |
| 46 | token 密钥派生不一致 | 用 BASE64URL 解码密钥签 token 访问 18080 | **401** 空体（`curl/10` #51） | **缺陷 P0-2 证据** |

---

## 4. D. 日志审查

审查对象：`app.log`（PID 27212 全量运行日志，含 SQL StdOut）。

| 检查点 | 结果 | 结论 |
|---|---|---|
| 明文密码 | `grep -c 'QcProbe@123' app.log` = **0**；`User.toString()` 已脱敏 | 通过 |
| 登录/注册日志内容 | 仅打印 `开始登录~`+脱敏 User、`账号不存在`、`当前用户{id}`，无口令 | 通过 |
| 响应中密码哈希 | 注册/登录/profile 响应均**无** password 字段（`@JsonProperty(WRITE_ONLY)` 生效） | 通过（静态 P1-5 在响应侧已修复） |
| 日志中密码哈希 | MyBatis StdOutImpl 打印 SQL 参数，出现 **5 处 `$2a$` BCrypt 哈希**（如 `qc_probe_a_ee60c1fd, $2a$12$f0ZM...` 出现在 INSERT Parameters 与 SELECT Row 中） | **缺陷 P2-2**（敏感信息入日志） |
| 异常堆栈 | `grep -cE '^\s+at (com\.wei|java\.|org\.)'` = **0**；`HanderEx` 仅 `log.error(e.toString())` | 缺陷 P2-3：排障只能看到一行异常类名，关键现场缺失（静态 P1-10"堆栈直出"在运行态已变为"零堆栈"，属另一种极端） |
| SQL StdOut 是否开启 | 是（application.yaml:28 `log-impl: org.apache.ibatis.logging.stdout.StdOutImpl`），每个请求打印完整 SQL/参数/结果行 | 缺陷 P2-2（噪音 + 敏感信息）；对应静态 P2-6 |
| 调用 `printStackTrace` | 未发现（0 处） | 通过 |
| 启动日志 WARN/ERROR | 0 条 | 通过 |
| Turnstile 失败 | `RoobitsController: 校验错误TurnstileResponse(success=false, errorCodes=[invalid-input-response]...)`，未触发 NPE | 通过（P1-9 的 NPE 路径未复现） |

---

## 5. 缺陷清单

> 每条含：现象 → 证据（文件 + 原始片段）→ 影响 → 与静态审计报告的对应关系。
> 严重度定义：P0 系统核心功能不可用；P1 主要功能/数据一致性/契约错误；P2 次要/健壮性/可维护性；信息 = 行为确认或与静态结论不一致需复核。

### P0-1【阻塞】正确凭据登录 100% 返回 500（JWT secret 解码异常）

- 现象：注册正常，任何用户用正确密码登录都得到 `HTTP 200 {"code":500,"message":"服务端有异常"}`。
- 证据：`curl/02_register_login.txt` #8；`app.log`：
  `ERROR ... com.wei.exceptionhander.HanderEx : java.lang.RuntimeException: java.lang.RuntimeException: io.jsonwebtoken.io.DecodingException: Illegal base64url character: '+'`
- 根因：`JwtUtil.java:33` 签发时用 `Decoders.BASE64URL.decode(secret)`，而 `env/dev.env` 的 `JWT_SECRET` 是**标准 base64**（长度 88、含 `+ /`），BASE64URL 解码器遇到 `+` 直接抛异常；异常经 `LoginImpl` 包装后被全局处理器吞成 500。
- 影响：登录接口完全不可用 → 前端无法获得 token → 全部受保护功能不可达。运行态为 **P0**（静态报告 P1-15 低估）。
- 对应静态条目：**P1-15（JWT 实现缺陷）**。

### P0-2【阻塞】登录签发的 token 必然验签失败（密钥派生方式不一致）

- 现象：即使把 secret 换成 BASE64URL 安全字符（临时实例 18081，`JWT_SECRET` 为 base64url 64 字节），登录成功返回 token（`code:0`），但**同一实例**用该 token 访问 `/auth/profile` 返回 **401 空体**；反向用 BASE64URL 解码后的密钥签 token 访问 18080 也 401。
- 证据：`curl/13_login_keymismatch_18081.txt`（login 200 含 token；随后 `HTTP/1.1 401 Content-Length: 0`）；`curl/10_token_actuator_delete.txt` #51 同结论；`app2_port_jwt_test.log`。
- 根因：`JwtUtil.java:33` `Keys.hmacShaKeyFor(Decoders.BASE64URL.decode(secret))` vs `JwtUtil.java:48` `Keys.hmacShaKeyFor(secret.getBytes())` —— 签发与校验使用**不同字节**作 HMAC key。
- 影响：修复 P0-1 后认证仍不可用（login 成功 → 所有后续请求 401 → 前端立即被登出）。两条 P0 相互独立，必须同时修。
- 对应静态条目：**P1-15**。

### P1-1 全局异常处理器吞掉 HTTP 状态码：404/405/413/500 一律 HTTP 200 + 通用文案

- 现象：`GET /nonexistent` → `200 {"code":404,"message":"服务端有异常"}`；`PATCH /anniversaries`、`PUT /photos`、`GET /auth/login` → `200 {"code":500,...}`；9MB 上传 → `200 code 500`（应 413）；`/birth` → `200 code 404` 但文案为"服务端有异常"。
- 证据：`curl/08_errors_405_404.txt`、`curl/09_welcome_upload_misc.txt`、`curl/15_birth_module.txt`；代码 `HanderEx.java:17-25`（`Result.error("服务端有异常",500)` 与 404 分支均返回 `Result`，未设置 `ResponseEntity.status`）。
- 影响：前端/网关/监控无法依据 HTTP 状态判断成败；404 文案误导排障；客户端重试、鉴权跳转逻辑全部失真。
- 对应静态条目：**P1-10**（其"堆栈直出"部分在运行态已不成立，但"HTTP 恒 200"成立）。

### P1-2 401 两套形态：拦截器 401 空响应体；控制器侧 token 无效返回 HTTP 200 + code 401

- 现象：无 token/坏 token/过期 token → `HTTP 401` + `Content-Length: 0`（前端拿不到 message）；而已删除用户的 token 走到控制器后返回 `HTTP 200 {"code":401,"message":"toke缺失/无效/过期"}`（拼写 "toke" 亦为错字）。
- 证据：`curl/01_unauth.txt`、`curl/03_auth_token.txt` #11-13、`curl/14_deleted_user_token.txt`。
- 影响：前端无法区分"未登录/过期/用户不存在"，且 axios 拦截器对 401 的全局登出逻辑在两套形态下行为不一致。
- 对应静态条目：**P2-5**（401 空体）、**P1-12**（资源不存在/不属于自己语义）。

### P1-3 越权/不存在资源的写操作返回"假成功"（HTTP 200、code=0、data=null）

- 现象：A `PUT /anniversaries/49`（B 的）→ `200 {"code":0,"data":null}`；A `PUT /anniversaries/999999` → 同样 `code:0`。B 数据复查未被修改（`title` 仍为 `qc_probe_anniv_B`）。
- 证据：`curl/05_cross_tenant.txt`。
- 影响：SQL 层 `user_id` 过滤使静态 **P0-1（横向越权篡改）已退化为 0 行静默更新**，数据安全面显著改善；但接口谎报成功——前端"保存成功"提示与真实结果相反，用户丢数据无感知。
- 对应静态条目：**P0-1（部分修复，剩余响应语义问题）**、**P2-2**（更新不存在返回 success）。

### P1-4 删除照片非原子：DB 行已删、OSS 抛异常后返回失败

- 现象：A `DELETE /photos {"key":"qc_probe_key_1"}`（行存在）→ `200 {"code":400,"message":"删除错误"}`；但数据库复查该行（id 48）**已被删除**；日志：`PhotoImpl: 删除失败Access key id should not be null or empty.`（无 OSS 凭据 → `OssUtil.delete` 抛 `InvalidCredentialsException`，被 `catch (Exception)` 吞掉并返回 0）。
- 证据：`curl/10_token_actuator_delete.txt` #57；`app.log` 对应行；`db_cleanup.txt`（清理时该用户仅剩 4 张照片）。
- 影响：客户端认为失败可重试，但服务端已删库 → 重试变 NPE（见 P2-5）；`PhotoImpl.delete` 无 `@Transactional`，DB 与 OSS 不一致。
- 对应静态条目：**P1-2、P1-3、P1-14**。

### P1-5 上传/参数异常统一吞成 `{"code":500,"message":"服务端有异常"}`，业务提示全部丢失

- 现象：缺文件（MultipartException）、非图片 MIME（`RuntimeException: 只允许 jpeg/png/webp/gif图片`）、9MB 超限（`MaxUploadSizeExceededException`）、坏 JSON、错误日期、超列长字段——全部 HTTP 200 + 通用 500 文案；原始可读提示只留在服务端日志。
- 证据：`curl/09_welcome_upload_misc.txt` #45-#49、`curl/08_errors_405_404.txt`；`app.log` 对应 ERROR 行。
- 影响：前端无法提示"格式不支持/文件过大（应 413）/字段超长"；用户只能看到"服务端有异常"。
- 对应静态条目：**P1-4、P1-10、P1-14**。

### P1-6 注册响应 `id:null` 且不返回 token

- 现象：注册成功响应 `data` 中 `"id":null`、`"token":null`；数据库中实际 id=29/30。
- 证据：`curl/02_register_login.txt` #5/#7；清理前 DB 查询 `tb_use` 29/30。
- 影响：前端注册后无法直接进入登录态，必须再调登录（而登录当前 P0 不可用）；违反接口文档；也无法用返回 id 做后续操作。
- 对应静态条目：**P1-7（原文即此条）**。

### P1-7 全项目无参数校验：弱口令、缺字段、空体直接入库或 500

- 现象：`password:"1"` 注册成功；无 `nickName` 注册成功；空体 `{}` 注册 → `IllegalArgumentException: rawPassword cannot be null` → 500；`lastId=abc` → 500；超长 user_name/title → DB 层 DataIntegrityViolation → 500。
- 证据：`curl/12_legacy_weak.txt` #63/#64、`curl/09` #49、`curl/07` #33。
- 影响：脏数据、弱口令账号、错误语义混乱；pom 无 `spring-boot-starter-validation`，`@Valid` 零使用。
- 对应静态条目：**P1-11、P2-1**。

### P1-8 生日模块整体不可用（控制器无路由映射）

- 现象：`GET /birth`、`POST /birth`、`GET /birthday`、`GET /birthdays` 全部 `200 {"code":404,"message":"服务端有异常"}`；`curl/15_birth_module.txt` 4 条一致。
- 影响：静态报告 P1-8 所述"生日模块整体不可用 + 7 个文档接口缺失"在运行态确认；且 404 被包装成"服务端有异常"，排障误导。
- 对应静态条目：**P1-8**。

### P1-9 `/photos` 相册契约错误：空列表为字符串、`hashMore` 拼写、limit 被忽略、固定 3 条、列表字段恒 null

- 现象：无数据 → `data:"目前还没图片"`（字符串）；有 5 行 → 返回 3 条 + `"hashMore":true`（正确拼写应为 `hasMore`）；`?limit=3` 与不传结果一致（SQL `LIMIT 3` 固定）；列表项 `userId:null`、`lastId:null`（select 未映射/无值）。
- 证据：`curl/06_photos_empty.txt`、`curl/07_photos_paging.txt`。
- 影响：前端按数组解析空态会崩；字段名与接口文档不符；页大小不可配。
- 对应静态条目：**P1-13**。

### P1-10 无任何 CORS 配置，跨域部署时浏览器拦截全部请求

- 现象：`OPTIONS /anniversaries`（带 `Origin` + `Access-Control-Request-Method`）→ 200 仅 `Allow: GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH`，**无 `Access-Control-Allow-Origin` / `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers`**；实际 `GET` 带 Origin 也无任何 CORS 响应头。
- 证据：`curl/09_welcome_upload_misc.txt` #47；`curl/10` #54。
- 影响：前端 dev 5173 或独立静态站（文档记录 `baseURL=https://cp.ywip.top:8443/api`）跨域时 CORS 预检必失败；`WebConfig` 无 `addCorsMappings`、无 `@CrossOrigin`、无 `CorsFilter`。
- 对应静态条目：**P2-7**（若确认前后端不同源，应升级为 P1）。

### P2-1 遗留明文密码用户永久无法登录（数据迁移缺陷）

- 现象：`tb_use` 中 id=1 `lover` 密码为明文 `123456`、id=2 `lo` 为 `123`；用正确明文登录 → `400 密码或用户名错误`，日志 `WARN o.s.s.c.bcrypt.BCryptPasswordEncoder: Encoded password does not look like BCrypt`（encoder.matches 对非 BCrypt 串直接判 false）。
- 证据：`curl/12_legacy_weak.txt` #62；`app.log` WARN 行；DB 查询（仅前缀/长度）。
- 影响：历史用户全部锁死且无提示；需一次性迁移为 BCrypt（或兼容旧格式）并通知改密。
- 对应静态条目：静态报告未单列（**新发现**，与 P1-6 数据安全主题相关）。

### P2-2 SQL StdOut 全量日志泄露 BCrypt 密码哈希

- 现象：`app.log` 出现 5 处 `$2a$`（如 INSERT Parameters 中的 `qc_probe_a_ee60c1fd, $2a$12$f0ZM...`，SELECT Row 中的用户整行）；`application.yaml:28` 开启 `StdOutImpl`。
- 影响：日志系统/运维可获取口令哈希（离线爆破风险）；日志噪音大、性能开销；生产不可接受。
- 对应静态条目：**P1-6（哈希入日志）、P2-6（StdOutImpl）**。注：响应侧密码泄漏（P1-5）在运行态已修复。

### P2-3 异常日志零堆栈

- 现象：`HanderEx` 仅 `log.error(e.toString())`，全日志 0 条 `at com.wei/...` 栈帧；登录 P0-1 也只能看到一行 `RuntimeException: ... DecodingException`。
- 影响：定位根因需靠猜测；与静态 P2-12（无 traceId/请求日志）叠加。
- 对应静态条目：**P2-12**；与 **P1-10** 的"堆栈直出"描述相反（修复过度）。

### P2-4 已删除用户的 token 仍通过验签，无吊销机制

- 现象：删除探针用户后，旧 token（未过期）`GET /anniversaries` 仍 200 `[]`（按 userId 查库）；`GET /auth/profile` 200 `{"code":401,...}`（控制器兜底，非拦截器）。
- 影响：删号/改密后旧 token 在有效期内仍可用；且 profile 用 HTTP 200 返回业务 401。
- 对应静态条目：**P2-11**（JWT 无法吊销）。

### P2-5 删除不存在的照片触发 NPE 且被吞

- 现象：`DELETE /photos {"key":"不存在"}` → 200 `{"code":400,"message":"删除错误"}`；日志 `PhotoImpl: 删除失败Cannot invoke "com.wei.pojo.Anniversaries.setId(java.lang.Integer)" because "A" is null`（select 返回 null 后直接 `A.setId`）。
- 影响：错误被伪造成业务失败；NPE 说明缺少空值判断，后续若放开事务/日志会放大。
- 对应静态条目：**P1-2**（NPE + 异常被吞）。

### P2-6 健康检查无鉴权暴露；静态 P2-4 的"actuator 被 401 拦截"未复现

- 现象：无 token `GET /actuator/health` → `200 {"status":"UP","groups":["liveness","readiness"]}`（拦截器 `WebConfig.java:25-26` 只拦截 `/**` 但 Spring Boot 4 的 actuator handler 不经过该 MVC 拦截器）；`/actuator/env` → 200 `{"code":404,...}`（端点未暴露，被静态资源处理器兜底）。
- 影响：health 可匿名访问（K8s 探针可用的同时也对外暴露运行状态）；与静态"探针被 401 拦死"结论相反，需确认预期拓扑后决定是否加 `management.endpoints.web.exposure`/安全约束。
- 对应静态条目：**P2-4（结论相反，需复核）**。

### P2-7【信息】`server.port` 硬编码 8080 但不是缺陷

- 现象：`application.yaml:31-32` 写死 8080；运行时 `--server.port=18080` 生效；临时实例 `SERVER_PORT=18081` 环境变量同样生效（`Tomcat started on port 18081`）。
- 结论：**环境变量可覆盖，硬编码仅作默认值**。因 `config.import` 依赖 CWD=demo/（P2-8），部署脚本应固定工作目录并显式传端口。

### P2-8【信息】启动强依赖 CWD=`demo/`

- 现象：`config.import: optional:file:env/${spring.profiles.active:dev}.env[.properties]`；本次以 `cd demo && java -jar ...` 启动成功；在其它目录启动会因占位符无法解析而失败（`optional:` 只忽略文件缺失）。
- 建议：启动脚本固定工作目录或用绝对路径/系统环境变量；对应静态 **P2-8**。

### P2-9【信息】列表/详情 DTO 缺字段

- 现象：`GET /anniversaries` 列表项 `userId:null`（SQL 未查 user_id）；`/auth/profile` 的 `creatTime:null`（`LoginMapper.GetUser` 只查 4 列）；响应 `Content-Type: application/json` 无 charset。
- 影响：前端若依赖这些字段会拿到 null；属契约整洁度问题。

### P2-10【信息】Turnstile 假 token 行为正常，NPE 路径未复现

- 现象：`POST /welcome` 假 token → 真实 Cloudflare 响应 `{"code":400,"message":"Verification failed: [invalid-input-response]"}`；出网正常。`RoobitsUtil` 中 response==null 的 NPE 需网络异常才触发，本次未构造到。
- 结论：静态 **P0-3/P1-9** 的 NPE 风险仍在代码中，但当前网络环境下未复现；建议按静态建议加超时与空判断。

---

## 6. 数据清理记录（仅探针数据）

写入的探针数据（均在 `qc_probe_` 命名空间内，或挂在该类用户下）：

| 表 | 内容 | 行数 |
|---|---|---|
| `tb_use` | 用户 29 `qc_probe_a_ee60c1fd`、30 `qc_probe_b_ee60c1fd`、31 `qc_probe_weak`、32 `qc_probe_nonick` | 4 |
| `anneriversaries` | id 49（user 30，title `qc_probe_anniv_B`）；user 29 的 id 48 已由接口自身 DELETE 用例删除 | 1（清理时） |
| `photo` | id 48–52（user 29，`_key` 以 `qc_probe_key_` 开头）；其中 48 已被 DELETE 用例（P1-4）删掉 | 4（清理时） |
| `birth` | 未写入（生日模块无路由，P1-8） | 0 |

清理 SQL（完整脚本 `cleanup_probe.sql`，执行记录 `db_cleanup.txt`）：

```sql
DELETE FROM photo           WHERE user_id IN (SELECT id FROM tb_use WHERE user_name LIKE 'qc_probe_%');
DELETE FROM anneriversaries WHERE user_id IN (SELECT id FROM tb_use WHERE user_name LIKE 'qc_probe_%');
DELETE FROM birth           WHERE user_id IN (SELECT id FROM tb_use WHERE user_name LIKE 'qc_probe_%');
DELETE FROM tb_use          WHERE user_name LIKE 'qc_probe_%';
```

影响行数（依次）：**photo 4 行、anneriversaries 1 行、birth 0 行、tb_use 4 行**。清理后复查：

- 全表计数：`tb_use=25`、`anneriversaries=2`、`photo=1`、`birth=1` —— 与检查前基线**完全一致**；
- 残留探针行：`0`；
- 原用户 12 的数据完好：纪念日 id 46/47、照片 id 47、生日 id 13 均原样保留（`db_cleanup.txt` 末尾复查）；
- **未删除/未修改任何其他用户数据**。

进程清理：`java` 进程 PID 27212（18080）、32824（18081 临时实例）、4356（复检生日模块的临时实例）均已 `taskkill /F`，`netstat` 复查 18080/18081 均无 LISTENING，无残留 java 进程（仅剩与本任务无关的 IntelliJ 自带 java）。

---

## 7. 覆盖度与未验证项

- 已真实覆盖：构建、jar 结构、启动日志、认证（登录/注册/拦截器/JWT 4 类非法 token）、越权矩阵（anniversaries 读/改/删、photos 删）、相册分页、错误处理（404/405/畸形 JSON/超长字段/非法参数）、上传（缺文件/坏 MIME/无凭据/超限）、CORS 预检与实际请求、Turnstile、并发 ThreadLocal、SQL 注入、遗留明文用户、生日模块 4 条路径、日志审查、DB 清理。
- 未覆盖/受限：
  1. OSS 成功上传路径（无凭据，仅验证到凭据异常前的参数校验；真实上传未测）；
  2. `/welcome` 成功路径（需要真实 Turnstile sitekey secret，假 token 只能验证失败分支）；
  3. 生日模块的接口契约（控制器无映射，无法测业务逻辑，仅测到 404）；
  4. 数据库唯一索引/表结构细节（未做 DDL 级验证，避免修改结构）；
  5. 前端（不在本任务范围）。

---

## 8. 附录：原始文件清单（`.qc/runtime/`）

| 文件 | 内容 |
|---|---|
| `build.log` | `mvn -o -B clean package` 全量输出（BUILD SUCCESS、测试、warning） |
| `app.log` | 主实例（18080）完整运行日志（启动 + 全部 HTTP/SQL/异常） |
| `app2_port_jwt_test.log` | 临时实例（18081，`SERVER_PORT` + base64url `JWT_SECRET`）启动与证据 |
| `app3_birth_check.log` | 复检生日模块用的临时实例启动日志 |
| `curl/01_unauth.txt` ~ `curl/15_birth_module.txt` | 46 + 条 curl 原始响应（逐项编号在文件内） |
| `jar_mapper_entries.txt` / `jar_uppercase_residue.txt` / `jar_oldpkg_residue.txt` | jar 内 mapper 与包名残留检查清单 |
| `db_tables.txt` / `db_baseline_users.txt` / `db_baseline_anniv.txt` | 检查前 DB 基线（表、用户、纪念日） |
| `insert_probe_photos.sql` / `cleanup_probe.sql` / `db_cleanup.txt` | 探针数据写入脚本、清理脚本、清理执行记录 |
| `token_a.txt` / `token_b.txt` / `token_u12.txt` / `token_issued_18081.txt` / `token_bad.txt` / `token_expired.txt` / `token_from_b64key.txt` | 各类构造 token（ASCII 密钥 / 18081 真实签发 / 非法 / 过期 / BASE64URL 密钥） |
| `login_ok_18081.json` | 18081 实例登录成功响应（P0-2 证据） |
| `probe_a_name.txt` / `probe_b_name.txt` / `qc_probe.png` / `qc_probe.txt` / `qc_probe_big.png` | 探针用户名、上传测试文件 |

---

### 给 Lead 的一句话结论

**构建 PASS、启动 PASS，但运行态认证链路存在 2 个相互独立的 P0（登录必 500、签发 token 必验签失败），即后端在真实前端流程下不可用**；另有 P1 级缺陷 10 条（HTTP 状态码恒 200、越权/不存在写操作假成功、删照片非原子、契约错误、无 CORS 等），数据已按规定清理并恢复基线。