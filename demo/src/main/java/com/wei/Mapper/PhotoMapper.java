package com.wei.mapper;


import com.wei.pojo.Photo;
import com.wei.pojo.Anniversaries;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface PhotoMapper {
    @Select("select url as bgImage, _key as ikey from user.photo where user_id=#{userId} and _key=#{key}")
    Anniversaries select(Photo p);
    @Options(useGeneratedKeys = true,keyProperty = "id")
    @Insert("INSERT INTO user.photo(_key, user_id, url, name, size, created_at) " +
            "VALUES (#{key},#{userId},#{url},#{name},#{size},#{createdAt})")
    void uploadImage(Photo p);

    @Delete("delete from user.photo where user_id=#{userId} and _key=#{key}")
    Integer delete(Photo p);

    @Select("select _key from user.photo where url=#{bgImage} and user_id=#{userId}")
    Photo selectKey(Anniversaries a);

    @Delete("delete from user.photo where url=#{bgImage} and user_id=#{userId}")
    Integer deleteBgImage(Anniversaries a);

    /*
    * 加载更多
    *
    * */

    List<Photo> selectAll(Photo p);
}
