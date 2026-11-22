package com.wei.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expire;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expire}") long expire) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("jwt.secret 未配置");
        }
        byte[] bytes = Decoders.BASE64.decode(secret);
        if (bytes.length < 32) {
            throw new IllegalStateException("jwt.secret 解码后不足 32 字节（HS256 要求）");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expire = expire;
    }

    public String CreatToken(String username, Integer id) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("username", username);
        claims.put("userId", id);
        String token = Jwts.builder()
                .signWith(key, Jwts.SIG.HS256)
                .claims(claims)
                .expiration(new Date(System.currentTimeMillis() + expire))
                .compact();
        log.debug("签发 token: id={}, username={}", id, username);
        return token;
    }

    public Claims praseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}