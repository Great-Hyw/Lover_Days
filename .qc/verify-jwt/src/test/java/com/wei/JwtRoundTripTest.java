package com.wei;

import com.wei.util.JwtUtil;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JwtRoundTripTest {

    @Test
    void signThenParse() {
        String raw = "0123456789abcdef0123456789abcdef"; // 32 字节 -> HS256 最小值
        String secret = Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        JwtUtil jwt = new JwtUtil(secret, 1800000L);

        String token = jwt.CreatToken("alice", 7);
        Claims claims = jwt.praseToken(token);

        assertEquals("alice", claims.get("username"));
        assertEquals(7, ((Number) claims.get("userId")).intValue());
    }
}
