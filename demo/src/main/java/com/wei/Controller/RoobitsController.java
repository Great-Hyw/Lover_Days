package com.wei.controller;


import com.wei.result.Result;
import com.wei.service.RoobitsImpl;
import com.wei.util.RoobitsUtil;
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
    private RoobitsUtil RoobitsUtil;
    @Autowired
    private RoobitsImpl roobitsIpml;


    @PostMapping("/welcome")
    public Result submitForm(@RequestBody roobit roobit, HttpServletRequest request) {
        TurnstileResponse validation =roobitsIpml.submitForm(roobit,request);
        if (validation.isSuccess()) {
            return Result.success("Form submitted successfully");
        } else {
            // Invalid token - reject submission
            log.error("校验错误"+validation);

            return Result.error("Verification failed: " + validation.getErrorCodes());
        }

    }
}

