package com.wei.controller;

import com.wei.result.Result;
import com.wei.service.LoginService;
import com.wei.pojo.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/auth")
public class LoginController {
    @Autowired
    private LoginService loginService;

    @RequestMapping("/login")
    public Result login(@RequestBody User use) {
        log.info("开始登录~"+use.toString());
        if (use == null) {
            return Result.error("字段缺失或者空的");
        }

        User user = loginService.login(use);

        if (user != null) {
            log.debug("结果" + user.toString());
            return Result.success(user);
        }
        return Result.error("密码或用户名错误");
    }

    @RequestMapping("/register")
    public Result Register(@RequestBody User user) {
        log.info("接收的前端数据" + user.toString());
        User i = loginService.register(user);

        if (i == null) {
            return Result.error("用户名已存在");
        }
        return Result.success(i);
    }
    @GetMapping("/profile")
    public Result GetUser(){

       User user= loginService.GetUser();

        if(user==null){
            return Result.TokenError("toke缺失/无效/过期");
        }

        return Result.success(user);
    }


}
