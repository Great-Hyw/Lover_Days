package com.wei.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoder;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.util.encoders.Base64Encoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;


@Slf4j
@Component
public class JwtUtil {

    private final  long expire;
    private final SecretKey key;

    public JwtUtil(  @Value("${jwt.secret}") String secret, @Value("${jwt.expire}") long expire) {
     this.key =  Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
     this.expire=expire;
    }

    public String CreatToken(String username, Integer id) throws Exception {
        try {
            Map<String, Object> chaim = new HashMap<>();
            chaim.put("username", username);
            chaim.put("userId", id);
            String token = Jwts.builder()//创建jwt构建器
                    .signWith(key, Jwts.SIG.HS256).claims(chaim).expiration(new Date(System.currentTimeMillis() + expire)).compact();
            log.debug("用户登录成功签发token：id:{},username:{}", id, username);
            return token;
        } catch (RuntimeException e) {
            throw new RuntimeException(e);
        }
    }

    public Claims praseToken(String token) throws Exception {
        try {

            return Jwts.parser()//解析器配置器
                    .verifyWith(key)//设置密钥
                    .build()//解析器生效
                    .parseSignedClaims(token).getPayload();
        } catch (RuntimeException e) {
            throw new RuntimeException(e);
        }
    }


}