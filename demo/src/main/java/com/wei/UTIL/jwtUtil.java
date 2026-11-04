package com.wei.UTIL;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
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
public class jwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expire}")
    private long expire;
    private SecretKey key;


    public String CreatToken(String username,Integer id) {
        key = Keys.hmacShaKeyFor(secret.getBytes());//创建密钥
        Map<String, Object> chaim = new HashMap<>();
        chaim.put("username", username);
        chaim.put("userId",id);
        String token = Jwts.builder()//创建jwt构建器
                .signWith(key)//设置密钥
                .addClaims(chaim)//添加声明
                .setExpiration(new Date(System.currentTimeMillis() + expire))//设置过期时间
                .compact();
        log.info("生成token：{}", token);
        return token;
    }

    public Claims praseToken(String token) throws Exception {
        key = Keys.hmacShaKeyFor(secret.getBytes());
        return Jwts.parser()//创建解析器
                .verifyWith(key)//设置密钥
                .build()//创建解析器
                .parseClaimsJws(token)//解析token
                .getBody();//获取claims
    }


}
