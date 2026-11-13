package com.wei.Controller;


import com.wei.Result.result;
import com.wei.UTIL.Rootbits;
import com.wei.pojo.TurnstileResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RoobitsController {

    // Controller usage
    @PostMapping("/welcome")
    public result submitForm(@RequestParam("token") String token, HttpServletRequest request) {

        String remoteip = request.getHeader("CF-Connecting-IP");
        if (remoteip == null) {
            remoteip = request.getHeader("X-Forwarded-For");
        }
        if (remoteip == null) {
            remoteip = request.getRemoteAddr();
        }


        TurnstileResponse validation = Rootbits.validateToken(token, remoteip);

        if (validation.isSuccess()) {
            // Valid token - process form
            return result.success("Form submitted successfully");
        } else {
            // Invalid token - reject submission
            return result.error("Verification failed: " + validation.getErrorCodes());
        }

    }
}

