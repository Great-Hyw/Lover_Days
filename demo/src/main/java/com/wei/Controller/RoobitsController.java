package com.wei.Controller;


import com.wei.Result.result;
import com.wei.UTIL.Rootbits;
import com.wei.pojo.TurnstileResponse;
import com.wei.pojo.roobit;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;


@Slf4j
@RestController
public class RoobitsController {
    @Autowired
    private Rootbits Rootbits;
    // Controller usage
    @PostMapping("/welcome")
    public result submitForm(@RequestBody roobit roobit, HttpServletRequest request) {

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

        TurnstileResponse validation = Rootbits.validateToken(roobit.getToken(), remoteip);

        if (validation.isSuccess()) {
            // Valid token - process form
            return result.success("Form submitted successfully");
        } else {
            // Invalid token - reject submission
            log.error("校验错误"+validation);

            return result.error("Verification failed: " + validation.getErrorCodes());
        }

    }
}

