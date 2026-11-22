package com.wei.service;


import com.wei.pojo.TurnstileResponse;
import com.wei.pojo.roobit;
import jakarta.servlet.http.HttpServletRequest;

public interface RoobitsService {
    public TurnstileResponse submitForm(roobit roobit, HttpServletRequest request);
}
