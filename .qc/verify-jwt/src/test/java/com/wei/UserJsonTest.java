package com.wei;

import com.wei.pojo.User;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 验证 User.password 的 Jackson 契约：
 * 1) 响应序列化时不得出现 password（含哈希），避免 P1-5 密码泄漏；
 * 2) 登录/注册的请求反序列化仍能读到 password，不能把登录打断。
 * 使用 Spring Boot 4 自带的 Jackson 3（tools.jackson）映射器，与 HTTP 层保持一致。
 */
class UserJsonTest {

    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void passwordIsNotSerialized() throws Exception {
        User user = new User();
        user.setUserName("alice");
        user.setPassword("$2a$12$secretHashShouldNeverLeak");
        user.setNickName("Alice");

        String json = mapper.writeValueAsString(user);

        assertFalse(json.contains("password"), "响应 JSON 不应包含 password 字段: " + json);
        assertFalse(json.contains("secretHashShouldNeverLeak"), "响应 JSON 不应泄漏密码哈希: " + json);
        assertTrue(json.contains("\"userName\":\"alice\""), "普通字段仍应正常序列化: " + json);
    }

    @Test
    void passwordIsStillDeserializedFromLoginRequest() throws Exception {
        User user = mapper.readValue(
                "{\"userName\":\"alice\",\"password\":\"plainPwd\"}", User.class);

        assertEquals("alice", user.getUserName());
        assertEquals("plainPwd", user.getPassword(), "登录请求中的 password 必须能反序列化");
    }
}