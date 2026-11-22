package com.wei.service;

import com.wei.pojo.User;

public interface LoginService {
    User login(User user);

    User register(User user);

    User GetUser();
}
