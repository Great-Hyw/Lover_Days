package com.wei.exceptionhander;

/**修复**：分层处理——`@ExceptionHandler(MethodArgumentNotValidException)` → 400 +
字段消息；``/`` → 404；`MaxUploadSizeExceededException` → 413；
业务异常自定义 `BizException(code,message)`；兜底 `Exception` → 500 + 「服务器内部错误」+ 完整日志（含 traceId），不返回堆栈。*/
import com.wei.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice//捕获全局异常//作用到全局controller
public class HanderEx {

    @ExceptionHandler(Exception.class)
    public Result handerExpection(Exception e){
        log.error(e.toString());
        return Result.error("服务端有异常",500);
    }
    @ExceptionHandler({NoResourceFoundException.class,  NoHandlerFoundException.class})
    public Result NoResourceFoundException(Exception e){
       log.error( e.toString());
        return Result.error("服务端有异常",404);
    }

}
