package com.wei.Service;

import com.wei.Mapper.loginMapper;
import com.wei.UTIL.CullentUtil;
import com.wei.UTIL.jwtUtil;
import com.wei.pojo.user;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@Slf4j
public class loginImpl implements loginService {
    @Autowired
    private loginMapper loginMapper;
    @Autowired
    private jwtUtil jwtUtil;

    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    @Override
    public user login(user user) {
        boolean matches=false;
        user user1=loginMapper.login(user);
        log.info("``````"+"此为登录界面"+user);
        if(user1==null){//账号不为空

             return null;
        }

        matches = encoder.matches(user.getPassword(), user1.getPassword());
        log.info("密码"+matches+user1.toString());
        if(matches) {
            String s = jwtUtil.CreatToken(user1.getUserName(), user1.getId());
            user1.setToken(s);
        }
        return matches?user1:null;

    }

    @Override
    @Transactional(rollbackFor = {Exception.class})
    public user register(user user) {

        user login = loginMapper.login(user);

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
    public user GetUser() {

        Integer id= CullentUtil.get();
        log.info("当前用户"+id);

        user user= loginMapper.GetUser(id);

        return user;

    }
}
