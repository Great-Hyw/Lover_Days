package com.wei.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class user {
    private String userName;
    private String password;
    private String nickName;
    private String avatar;
    private Integer id;
    private LocalDateTime creatTime;
    private LocalDateTime updateTime;
    private String token;

    @Override
    public String toString() {
        return "user{" +
                "userName='" + userName + '\'' +
                ", passwordHash='" + password + '\'' +
                ", nickName='" + nickName + '\'' +
                ", avatar='" + avatar + '\'' +
                ", id='" + id + '\'' +
                ", creatTime=" + creatTime +
                ", updateTime=" + updateTime +
                '}';
    }
}
