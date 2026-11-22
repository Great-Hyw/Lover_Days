package com.wei.Mapper;

import com.wei.pojo.anniversaries;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface anniversariesMapper {
    @Options(useGeneratedKeys = true,keyProperty = "id")
    @Insert("insert into user.anneriversaries" +
            "(id, user_id, title, date, type, icon, color, is_yearly, note, bg_image, created_at) " +
            "VALUES (#{id},#{userId},#{title},#{date},#{type},#{icon},#{color},#{isYearly},#{note},#{bgImage},#{createdAt})")
         Integer insertann(anniversaries a);


    /*
    * 查询当前用户的所有纪念日
    * */
    @Select("select id, title, date, type, icon, color, is_yearly, note, bg_image, created_at, updated_at from user.anneriversaries where user_id=#{userId} ")
    List<anniversaries> Get(Integer userId);


    @Select("select title from user.anneriversaries where user_id=#{userId} and title = #{title} ")
    anniversaries getAnn(anniversaries a);

    /*
    * 查询当前id的纪念日的所有信息
    * */
    @Select("select id, title, date, type, icon, color, is_yearly, note, bg_image, created_at, updated_at from user.anneriversaries where id=#{id} and user_id=#{userId}")
    anniversaries GetannID(anniversaries a);

    int update(anniversaries a);

    @Delete("delete from user.anneriversaries where user_id=#{userId} and id=#{id}")
    Integer delete(anniversaries id);


    @Update("update user.anneriversaries set bg_image=#{url} where user_id=#{photo.userId} and bg_image=#{photo.bgImage}")
    void updateann(@Param("photo") anniversaries a,@Param("url") String url);

/*
* 查询当前背景图是否有其他人使用
* */
    @Select("select * from user.anneriversaries where bg_image=#{bgImage}")
    List<anniversaries> selectBgimage(anniversaries a);
}
