package com.wei.service;

import com.wei.mapper.LoginMapper;
import com.wei.util.CullentUtil;
import com.wei.util.JwtUtil;
import com.wei.pojo.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@Slf4j
public class LoginImpl implements LoginService {
    @Autowired
    private LoginMapper loginMapper;
    @Autowired
    private JwtUtil jwtUtil;

    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    @Override
    public User login(User user) {
        boolean matches=false;
        User user1=loginMapper.login(user);
        log.info("``````"+"此为登录界面");
        if(user1==null){//账号不为空
            log.error("账号不存在");
             return null;
        }

        matches = encoder.matches(user.getPassword(), user1.getPassword());
        try {
            if (matches) {
                String s = jwtUtil.CreatToken(user1.getUserName(), user1.getId());
                user1.setToken(s);
            }
            return matches ? user1 : null;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    @Transactional(rollbackFor = {Exception.class})
    public User register(User user) {

        User login = loginMapper.login(user);

        if(login!=null){//账户已存在
            return null;
        }

        String password=encoder.encode(user.getPassword());

        LocalDateTime now=LocalDateTime.now();

        user.setPassword(password);

        user.setCreatTime(now);

        loginMapper.register(user);

        return user;
    }

    @Override
    public User GetUser() {

        Integer id= CullentUtil.get();
        log.info("当前用户"+id);

        User user= loginMapper.GetUser(id);

        return user;

    }
}
