package com.wei.ExceptionHander;


import com.wei.Result.result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice//捕获全局异常
public class henderEx {

    @ExceptionHandler(Exception.class)
    public result handerExpection( Exception e){
        e.printStackTrace();
        return result.error("服务端有异常");
    }
}
