package com.wei.pojo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private String userName;
    /**
     * 只允许反序列化（登录/注册请求可带明文密码），序列化时绝不输出。
     * 用 WRITE_ONLY 而不是 @JsonIgnore：@JsonIgnore 会连请求体里的密码一起忽略，导致登录失败。
     */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
    private String nickName;
    private String avatar;
    private Integer id;
    private String rtoken;
    private LocalDateTime creatTime;
    private LocalDateTime updateTime;
    private String token;

    @Override
    public String toString() {
        return "user{" +
                "userName='" + userName + '\'' +
                ", nickName='" + nickName + '\'' +
                ", avatar='" + avatar + '\'' +
                ", id='" + id + '\'' +
                ", creatTime=" + creatTime +
                ", updateTime=" + updateTime +
                '}';
    }
}
