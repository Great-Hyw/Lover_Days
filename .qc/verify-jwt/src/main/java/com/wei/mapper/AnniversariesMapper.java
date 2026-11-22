package com.wei.mapper;

import com.wei.pojo.Anniversaries;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface AnniversariesMapper {
    @Options(useGeneratedKeys = true,keyProperty = "id")
    @Insert("insert into user.anneriversaries" +
            "(id, user_id, title, date, type, icon, color, is_yearly, note, bg_image, created_at) " +
            "VALUES (#{id},#{userId},#{title},#{date},#{type},#{icon},#{color},#{isYearly},#{note},#{bgImage},#{createdAt})")
         Integer insertann(Anniversaries a);


    /*
    * 查询当前用户的所有纪念日
    * */
    @Select("select id, title, date, type, icon, color, is_yearly, note, bg_image, created_at, updated_at from user.anneriversaries where user_id=#{userId} ")
    List<Anniversaries> Get(Integer userId);


    @Select("select title from user.anneriversaries where user_id=#{userId} and title = #{title} ")
    Anniversaries getAnn(Anniversaries a);

    /*
    * 查询当前id的纪念日的所有信息
    * */
    @Select("select id, title, date, type, icon, color, is_yearly, note, bg_image, created_at, updated_at from user.anneriversaries where id=#{id} and user_id=#{userId}")
    Anniversaries GetannID(Anniversaries a);

    int update(Anniversaries a);

    @Delete("delete from user.anneriversaries where user_id=#{userId} and id=#{id}")
    Integer delete(Anniversaries id);


    @Update("update user.anneriversaries set bg_image=#{url} where user_id=#{photo.userId} and bg_image=#{photo.bgImage}")
    void updateann(@Param("photo") Anniversaries a, @Param("url") String url);

/*
* 查询当前背景图是否有其他人使用
* */
    @Select("select * from user.anneriversaries where bg_image=#{bgImage}")
    List<Anniversaries> selectBgimage(Anniversaries a);
}
