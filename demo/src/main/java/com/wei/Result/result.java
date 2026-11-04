package com.wei.Result;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j//开启日志
@Data
@AllArgsConstructor
@NoArgsConstructor
public class result {
    private Integer code;
    private String message;
    private Object data;

    public static result success() {
        result result = new result();
        result.code = 0;
        result.message = "success";
        return result;
    }

    public static result success(Object data) {
        result result = new result();
        result.code = 0;
        result.message = "success";
        result.data = data;
        return result;
    }

    public static result error(String mes){
        result result=new result();
        result.code=400;
        result.message=mes;
        return result;
    }

    public  static result TokenError(String mes){
        result result=new result();
        result.code=401;
        result.message=mes;
        return result;
    }


}
