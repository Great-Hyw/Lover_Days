package com.wei.service;

import com.wei.pojo.TurnstileResponse;
import com.wei.pojo.User;
import jakarta.servlet.http.HttpServletRequest;

public interface LoginService {
    User login(User user);

    User register(User user);

    User GetUser();

    TurnstileResponse roobitVerify(String rtoken, HttpServletRequest request);
}
