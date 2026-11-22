package com.wei.result;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j//开启日志
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Result {
    private Integer code;
    private String message;
    private Object data;

    public static Result success() {
        Result result = new Result();
        result.code = 0;
        result.message = "success";
        return result;
    }

    public static Result success(Object data) {
        Result result = new Result();
        result.code = 0;
        result.message = "success";
        result.data = data;
        return result;
    }

    public static Result error(String mes){
        Result result=new Result();
        result.code=400;
        result.message=mes;
        return result;
    }
    public static Result error(String mes,Integer code){
        Result result=new Result();
        result.code=code;
        result.message=mes;
        return result;
    }

    public  static Result TokenError(String mes){
        Result result=new Result();
        result.code=401;
        result.message=mes;
        return result;
    }


}
