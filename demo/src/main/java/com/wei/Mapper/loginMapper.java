package com.wei.mapper;

import com.wei.pojo.User;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LoginMapper {
    @Select("select * from user.tb_use where user_name=#{userName} ")
    User login(User user);

    @Insert("insert into tb_use( user_name, password, nick_name, creatTime) values (#{userName},#{password},#{nickName},#{creatTime})")
    void register(User user);

    @Select("select id, user_name, nick_name, avatar from tb_use where id=#{id}")
    User GetUser(Integer id);
}
