package com.wei.Mapper;


import com.wei.pojo.Photo;
import com.wei.pojo.anniversaries;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface PhotoMapper {

    @Select("select url as bgImage from user.photo where user_id=#{userId} and _key=#{key}")
    anniversaries select(Photo p);

    @Insert("INSERT INTO user.photo(_key, user_id, url, name, size, created_at) " +
            "VALUES (#{key},#{userId},#{url},#{name},#{size},#{createdAt})")
    void uploadImage(Photo p);

    @Delete("delete from user.photo where user_id=#{userId} and _key=#{key}")
    Integer delete(Photo p);

    @Select("select _key from user.photo where url=#{bgImage} and user_id=#{userId}")
    Photo selectKey(anniversaries a);

    @Delete("delete from user.photo where url=#{bgImage}")
    Integer deleteBgImage(anniversaries a);

    /*
    * 加载更多
    *
    * */

    List<Photo> selectAll(Photo p);
}
