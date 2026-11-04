package com.wei.Controller;

import com.wei.Result.result;
import com.wei.Service.loginService;
import com.wei.pojo.user;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/auth")
public class loginController {
    @Autowired
    private loginService loginService;

    @RequestMapping("/login")
    public result login(@RequestBody user use) {
        log.info("开始登录~");
        if (use == null) {
            return result.error("字段缺失或者空的");
        }

        user user = loginService.login(use);

        if (user != null) {
            log.info("结果" + user.toString());
            return result.success(user);
        }
        return result.error("密码或用户名错误");
    }

    @RequestMapping("/register")
    public result Register(@RequestBody user user) {
        log.info("接收的前端数据" + user.toString());
        user i = loginService.register(user);

        if (i == null) {
            return result.error("用户名已存在");
        }
        return result.success(i);
    }
    @GetMapping("/profile")
    public result GetUser(){

       user user= loginService.GetUser();

        if(user==null){
            return result.TokenError("toke缺失/无效/过期");
        }

        return result.success(user);
    }


}
