package com.wei.Mapper;

import com.wei.pojo.user;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface loginMapper {
    @Select("select * from user.tb_use where user_name=#{userName} ")
    user login(user user);

    @Insert("insert into tb_use( user_name, password, nick_name, creatTime) values (#{userName},#{password},#{nickName},#{creatTime})")
    void register(user user);

    @Select("select id, user_name, password, nick_name, avatar from tb_use where id=#{id}")
    user GetUser(Integer id);
}
