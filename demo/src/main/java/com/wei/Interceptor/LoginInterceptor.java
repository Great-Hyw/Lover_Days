package com.wei.Interceptor;

import com.wei.util.CullentUtil;
import com.wei.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@Slf4j
public class LoginInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtUtil jwtUtil;//令牌工具类

    /*
     * 拦截器
     * */
    @Override
    public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) throws Exception {
        String jwt=null;

        if("OPTIONS".equalsIgnoreCase(request.getMethod())){
            return true;//预检放行
        }

        String token = request.getHeader("Authorization");
        if(token == null || !token.startsWith("Bearer ")){
           response.setStatus(401);
           return false;
        }
        jwt = token.substring(7); // 截掉 "Bearer " 这7个字符
        if (jwt.isEmpty()) {
            response.setStatus(401);
            return false;//不放行
        }
        //令牌解析
        try {
            Claims claims = jwtUtil.praseToken(jwt);
            Integer id = (Integer) claims.get("userId");
            CullentUtil.set(id);

        } catch (Exception e) {//令牌非法返回401
            log.error("token非法");
            response.setStatus(401);
            return false;//不放行
        }
        return true;//解析成功放行
    }

    @Override
    public void afterCompletion( @NonNull HttpServletRequest request, @NonNull  HttpServletResponse response, Object handler, @Nullable Exception ex) throws Exception {
        CullentUtil.remove();
    }

}
