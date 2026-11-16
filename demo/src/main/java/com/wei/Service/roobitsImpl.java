package com.wei.Service;

import com.wei.UTIL.RoobitsUtil;
import com.wei.pojo.TurnstileResponse;
import com.wei.pojo.roobit;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


@Slf4j
@Service
public class roobitsImpl implements RootbitsServivce{

    @Autowired
    private RoobitsUtil RoobitsUtil;

    @Override
    public  TurnstileResponse submitForm(roobit roobit, HttpServletRequest request) {
        String remoteip = request.getHeader("CF-Connecting-IP");
        log.info("remoteip cf-ip:"+remoteip);
        if (remoteip == null) {
            remoteip = request.getHeader("X-Forwarded-For");
            log.info("remoteip-for  :"+remoteip);
        }
        if (remoteip == null) {
            remoteip = request.getRemoteAddr();
        }
        log.info("remoteip:"+remoteip);

        return RoobitsUtil.validateToken(roobit.getToken(), remoteip);

    }
}
