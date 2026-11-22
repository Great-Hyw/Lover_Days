package com.wei.Service;


import com.wei.pojo.TurnstileResponse;
import com.wei.pojo.roobit;
import jakarta.servlet.http.HttpServletRequest;

public interface RootbitsServivce {
    public TurnstileResponse submitForm(roobit roobit, HttpServletRequest request);
}
