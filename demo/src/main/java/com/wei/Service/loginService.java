package com.wei.Service;

import com.wei.pojo.user;

public interface loginService {
    user login(user user);

    user register(user user);

    user GetUser();
}
