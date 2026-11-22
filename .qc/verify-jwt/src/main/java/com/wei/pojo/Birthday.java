package com.wei.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Birthday {
    private Integer id;
    private String birthday;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}