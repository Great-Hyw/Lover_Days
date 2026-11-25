package com.wei.util;

import com.wei.pojo.TurnstileResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


@Slf4j
@Service
public class RoobitVerfyUtil {

    @Autowired
    private RoobitsUtil RoobitsUtil;

    public TurnstileResponse submitForm(String token, HttpServletRequest request) {
        String remoteip = request.getHeader("CF-Connecting-IP");
        log.info("remoteip cf-ip:" + remoteip);
        if (remoteip == null) {
            remoteip = request.getHeader("X-Forwarded-For");
            log.info("remoteip-for  :" + remoteip);
        }
        if (remoteip == null) {
            remoteip = request.getRemoteAddr();
        }
        log.info("remoteip:" + remoteip);

        return RoobitsUtil.validateToken(token, remoteip);

    }
}
